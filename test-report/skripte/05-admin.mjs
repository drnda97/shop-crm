import { readFileSync, existsSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createHmac } from "node:crypto";
import { Session, check, section, done, q, short, note, ACTIONS } from "./h.mjs";
const state = JSON.parse(readFileSync(new URL("../state.json", import.meta.url)));
const keys = JSON.parse(readFileSync(new URL("../keys.json", import.meta.url)));
const mailFile = new URL("../mails.jsonl", import.meta.url);
const mails = () => (existsSync(mailFile) ? readFileSync(mailFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const decode = (data) => data.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errOf = (r) => decodeURIComponent(r.redirect?.match(/greska=(.*)$/)?.[1] ?? r.value?.error ?? "");
const login = async (username, password = "Lozinka-12345", code = "") => {
  const s = new Session();
  const r = await s.act("login", { prev: true, form: { username, password, code } }, { path: "/admin" });
  s.loginResult = r;
  return s;
};
const stock = async (slug) => (await q("SELECT stock_qty FROM products WHERE slug=?", [slug]))[0]?.stock_qty;
const orderRow = async (n) => (await q("SELECT * FROM orders WHERE number=?", [n]))[0];

// Lokalni prijemnik webhook-ova (samo 127.0.0.1)
const hooks = [];
const receiver = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => { hooks.push({ url: req.url, headers: req.headers, body }); res.writeHead(req.url.includes("fail") ? 500 : 200); res.end("ok"); });
}).listen(3999, "127.0.0.1");

const s = await login("vlasnik");
let r;

section("Panel: sve stranice se otvaraju (vlasnik)");
const adminPages = ["/admin", "/admin/porudzbine", `/admin/porudzbine/${state.first}`, "/admin/porudzbine/nova", "/admin/kupci", "/admin/korpe", "/admin/poruke", "/admin/utisci", "/admin/izvestaji", "/admin/proizvodi", "/admin/proizvodi/novi", "/admin/proizvodi/stolica-test", "/admin/proizvodi/fotelja-varijante", "/admin/proizvodi/img-src-x-onerror-alert-1-xss", "/admin/proizvodi/uvoz", "/admin/kategorije", "/admin/kolekcije", "/admin/popusti", "/admin/popusti/novi", "/admin/popusti/leto", "/admin/stranice", "/admin/stranice/nova", "/admin/stranice/pocetna", "/admin/blog", "/admin/izgled", "/admin/izgled/tema", "/admin/izgled/meni", "/admin/slike", "/admin/integracije", "/admin/korisnici", "/admin/dnevnik", "/admin/nalog", "/admin/podesavanja", "/admin/prevodi", `/admin/porudzbine/${state.evilNumber}`];
for (const path of adminPages) {
  r = await s.get(path);
  const bad = /Application error|Internal Server Error|digest/.test(r.text.slice(0, 3000));
  check("pos", `GET ${path}`, r.status === 200 && !bad && r.text.length > 1000, `status ${r.status} ${r.location ?? ""}`);
}
for (const path of ["/admin/porudzbine/999999", "/admin/porudzbine/abc", "/admin/proizvodi/nepostoji", "/admin/popusti/nepostoji", "/admin/stranice/nepostoji", "/admin/blog/999", "/admin/kolekcije/nepostoji", "/admin/kupci/nepostoji", "/admin/izgled/nepostoji", "/admin/porudzbine/1001%27%20OR%201=1"]) {
  r = await s.get(path);
  check("neg", `GET ${path} (nepostojeće) ne ruši panel`, [404, 307, 302].includes(r.status) || (r.status === 200 && !/digest/.test(r.text.slice(0, 2000))), `status ${r.status} ${r.location ?? ""}`);
}
// XSS u panelu: porudžbina kupca sa <script> u imenu, kontakt poruka, utisak
for (const path of [`/admin/porudzbine/${state.evilNumber}`, "/admin/porudzbine", "/admin/kupci", "/admin/poruke", "/admin/utisci", "/admin", "/admin/dnevnik", "/admin/proizvodi", "/admin/izvestaji"]) {
  r = await s.get(path);
  const raw = /<script>alert\((?:'xss'|'poruka'|'utisak'|\d)\)<\/script>|<img src=x onerror=alert\(1\)>/.test(r.text);
  check("sec", `panel ne izvršava HTML kupca: ${path}`, !raw, raw ? "NEIZBEGNUT HTML KUPCA U PANELU" : "");
}

section("Panel: porudžbina — statusi i stanje");
const n = state.mine; // 1 × stolica-test
const st0 = await stock("stolica-test");
const setStatus = (number, status) => s.act("setOrderStatusAction", { form: { number, status } }, { path: "/admin/porudzbine" });
r = await setStatus(n, "confirmed");
check("pos", "status: potvrđena", (await orderRow(n)).status === "confirmed", r.redirect);
r = await setStatus(n, "nepostojeci-status");
check("neg", "nepoznat status se ignoriše", (await orderRow(n)).status === "confirmed", r.redirect);
r = await setStatus(n, "cancelled");
check("pos", "otkazivanje vraća komad na stanje", (await stock("stolica-test")) === st0 + 1, `${st0} → ${await stock("stolica-test")}`);
r = await setStatus(n, "cancelled");
check("pos", "otkazivanje dva puta ne vraća komad dva puta", (await stock("stolica-test")) === st0 + 1, `${await stock("stolica-test")}`);
r = await setStatus(n, "new");
check("pos", "vraćanje otkazane porudžbine ponovo skida komad", (await stock("stolica-test")) === st0, `${await stock("stolica-test")}`);
await setStatus(n, "shipped");
r = await s.act("saveTrackingAction", { form: { number: n, trackingNumber: "RS123456789", trackingUrl: "https://kurir.example/prati/RS123456789" } }, { path: "/admin/porudzbine" });
check("pos", "broj pošiljke", (await orderRow(n)).tracking_number === "RS123456789", r.redirect);
r = await s.act("saveTrackingAction", { form: { number: n, trackingNumber: "X", trackingUrl: "javascript:alert(1)" } }, { path: "/admin/porudzbine" });
check("sec", "adresa za praćenje „javascript:“ se odbija", /https/.test(errOf(r)) && (await orderRow(n)).tracking_url.startsWith("https://"), errOf(r));
r = await s.act("setOrderPaidAction", { form: { number: n, paid: "yes" } }, { path: "/admin/porudzbine" });
check("pos", "oznaka plaćeno", (await orderRow(n)).paid_at !== null, r.redirect);
r = await s.act("saveOrderNoteAction", { form: { number: n, note: "Interna beleška <b>test</b>" } }, { path: "/admin/porudzbine" });
check("pos", "beleška prodavca", (await orderRow(n)).admin_note?.includes("Interna"), r.redirect);
r = await s.act("saveOrderNoteAction", { form: { number: n, note: "x", back: "https://evil.example/phish" } }, { path: "/admin/porudzbine" });
check("sec", "polje „back“ ne preusmerava van panela (open redirect)", r.redirect?.startsWith("/admin"), r.redirect);
r = await s.act("saveOrderNoteAction", { form: { number: n, note: "x", back: "/admin/../../evil" } }, { path: "/admin/porudzbine" });
note(`back=/admin/../../evil → ${r.redirect}`);
r = await s.act("saveOrderCustomerAction", { form: { number: n, name: "Mira Kupac", phone: "064 555 1234", email: "mira@example.test", street: "Ispravljena 7", city: "Novi Sad", postalCode: "21000", note: "" } }, { path: "/admin/porudzbine" });
check("pos", "ispravka adrese kupca", (await orderRow(n)).street === "Ispravljena 7", r.redirect);
r = await s.act("saveOrderCustomerAction", { form: { number: n, name: "", phone: "x", email: "x", street: "", city: "", postalCode: "" } }, { path: "/admin/porudzbine" });
check("neg", "ispravka sa neispravnim podacima se odbija", !!errOf(r) && (await orderRow(n)).street === "Ispravljena 7", errOf(r));
await wait(1500);
const statusMails = mails().filter((m) => m.to.some((t) => t.includes("mira@")) && /Subject:/.test(m.data));
note(`email poruka kupcu mira@ do sada: ${statusMails.length}`);
r = await s.get(`/admin/porudzbine/${n}/racun`);
check("pos", "račun u PDF-u iz panela", r.status === 200 && r.text.startsWith("%PDF"), `status ${r.status}`);

section("Panel: povraćaj novca i robe");
const refund = (form) => s.act("refundOrderAction", { form: { number: n, ...form } }, { path: "/admin/porudzbine" });
const total = (await orderRow(n)).total;
r = await refund({ amount: "0" });
check("neg", "povraćaj 0 se odbija", /iznos/.test(errOf(r)), errOf(r));
r = await refund({ amount: "-500" });
check("neg", "negativan povraćaj se odbija", /iznos/.test(errOf(r)), errOf(r));
r = await refund({ amount: String(total + 1) });
check("neg", "povraćaj veći od iznosa porudžbine se odbija", /Najviše/.test(errOf(r)), errOf(r));
const stB = await stock("stolica-test");
r = await refund({ amount: "3000", reason: "Oštećenje", "returned-0": "5" });
check("pos", "delimičan povraćaj 3000 + vraćen komad (traženo 5, vraća se najviše 1)", (await orderRow(n)).refunded === 3000 && (await stock("stolica-test")) === stB + 1, `refunded ${(await orderRow(n)).refunded}, stanje ${stB} → ${await stock("stolica-test")}`);
r = await refund({ amount: String(total - 3000 + 1) });
check("neg", "zbir povraćaja ne može preko iznosa porudžbine", /Najviše/.test(errOf(r)), errOf(r));
// Dva povraćaja u istom trenutku: zbir ne sme preko ukupnog
const rest = total - 3000;
const both = await Promise.all([refund({ amount: String(rest) }), refund({ amount: String(rest) })]);
check("sec", "dva istovremena povraćaja celog ostatka: prolazi samo jedan", (await orderRow(n)).refunded === total, `refunded ${(await orderRow(n)).refunded} od ${total}`);
r = await setStatus(n, "cancelled");
check("pos", "otkazivanje posle povraćaja robe ne vraća isti komad dva puta", (await stock("stolica-test")) === stB + 1, `stanje ${await stock("stolica-test")}`);

section("Panel: ručna porudžbina, zahtev za povrat, utisci, kupci");
r = await s.act("createManualOrderAction", [{ customer: { name: "Telefonski Kupac", phone: "063 111 2222", email: "tel@example.test", street: "Ulica 2", city: "Niš", postalCode: "18000", note: "" }, items: [{ slug: "lampa-akcija", qty: 2 }], paymentMethod: "cod", deliveryMethod: "kurir" }], { path: "/admin/porudzbine/nova" });
const manual = r.value?.number;
check("pos", "ručna porudžbina", r.value?.ok === true, short(r.value));
r = await s.act("createManualOrderAction", [{ customer: { name: "X" }, items: [] }], { path: "/admin/porudzbine/nova" });
check("neg", "ručna porudžbina bez podataka", r.value?.ok === false, short(r.value));
r = await s.act("createManualOrderAction", [{ customer: { name: "Telefonski Kupac", phone: "063 111 2222", email: "tel@example.test", street: "Ulica 2", city: "Niš", postalCode: "18000", note: "" }, items: [{ slug: "lampa-akcija", qty: 1 }], paymentMethod: "card" }], { path: "/admin/porudzbine/nova" });
check("neg", "ručna porudžbina karticom se odbija", r.value?.ok === false, short(r.value));
await setStatus(manual, "delivered");
const anon = new Session();
r = await anon.act("returnRequestAction", [{ number: String(manual), email: "tel@example.test", items: [{ position: 0, qty: 99 }, { position: 5, qty: 1 }, { position: -1, qty: 1 }], reason: "Predomislio sam se." }], { path: "/pracenje" });
check("pos", "zahtev kupca za povrat (traženo 99, upisuje se najviše 2)", r.value?.ok === true && /2 ×/.test(r.value?.order?.returns?.[0]?.items ?? ""), short(r.value?.order?.returns));
r = await anon.act("returnRequestAction", [{ number: String(manual), email: "tel@example.test", items: [{ position: 0, qty: 1 }], reason: "Još jedan zahtev." }], { path: "/pracenje" });
check("neg", "drugi zahtev dok prvi čeka se odbija", r.value?.ok === false, short(r.value));
const reqId = (await q("SELECT id FROM return_requests WHERE order_number=?", [manual]))[0]?.id;
r = await s.act("resolveReturnAction", { form: { number: manual, id: reqId, decision: "reject", answer: "" } }, { path: "/admin/porudzbine" });
check("neg", "odbijanje povrata bez razloga se ne prihvata", /razlog/.test(errOf(r)), errOf(r));
r = await s.act("resolveReturnAction", { form: { number: manual, id: reqId, decision: "approve", answer: "Pošaljite na našu adresu." } }, { path: "/admin/porudzbine" });
check("pos", "odobren zahtev za povrat", (await q("SELECT status FROM return_requests WHERE id=?", [reqId]))[0].status === "approved", r.redirect);
r = await s.act("resolveReturnAction", { form: { number: manual, id: reqId, decision: "reject", answer: "Ipak ne." } }, { path: "/admin/porudzbine" });
check("neg", "već rešen zahtev se ne menja", /već rešen/.test(errOf(r)), errOf(r));
const rev = (await q("SELECT id FROM reviews LIMIT 1"))[0]?.id;
r = await s.act("reviewStatusAction", { form: { id: rev, status: "approved" } }, { path: "/admin/utisci" });
const prod = await anon.get("/proizvod/stolica-test");
check("pos", "odobren utisak se vidi na stranici proizvoda", /Odlična stolica!/.test(prod.text), "");
check("sec", "…a HTML iz utiska je izbegnut", !/<script>alert\('utisak'\)<\/script>/.test(prod.text), "");
r = await s.get("/admin/kupci");
check("pos", "spisak kupaca prikazuje kupce", /Petar Petrović/.test(r.text) && /Mira Kupac/.test(r.text), `status ${r.status}`);
const key = (await orderRow(state.first)).customer_key;
r = await s.get(`/admin/kupci/${key}`);
check("pos", "stranica kupca sa istorijom porudžbina", r.status === 200 && new RegExp(String(state.first)).test(r.text), `status ${r.status}`);
r = await s.get(`/admin/kupci/${key}/podaci`);
check("pos", "izvoz podataka kupca (zahtev po GDPR-u)", r.status === 200 && /petar@example\.test/.test(r.text), `status ${r.status} ${r.headers.get("content-type")}`);
r = await s.act("saveCustomerNoteAction", { form: { key, note: "Dobar kupac" } }, { path: "/admin/kupci" });
check("pos", "beleška o kupcu", /ok=/.test(r.redirect ?? ""), r.redirect);

section("Panel: izvozi u CSV i formule (CSV injection)");
for (const [path, must] of [["/admin/porudzbine/izvoz", "Petar"], ["/admin/kupci/izvoz", "Petar"], ["/admin/proizvodi/izvoz", "stolica-test"], ["/admin/poruke/izvoz", "novosti@example.test"], ["/admin/izvestaji/izvoz", ""]]) {
  r = await s.get(path);
  check("pos", `izvoz ${path}`, r.status === 200 && /text\/csv/.test(r.headers.get("content-type") ?? "") && r.text.includes(must), `status ${r.status} ${r.headers.get("content-type")} ${r.text.length} bajtova`);
  if (path.includes("porudzbine") || path.includes("kupci")) {
    const cells = r.text.split(/\r\n/).flatMap((line) => line.split(";")).map((c) => c.replace(/^"/, ""));
    const formulas = cells.filter((c) => /^[=+@]|^-\d/.test(c)).slice(0, 4);
    check("sec", `${path}: ćelije ne počinju znakom formule (=, +, -, @)`, formulas.length === 0, `Excel bi ovo izvršio kao formulu: ${formulas.join(" | ")}`);
  }
}

section("Panel: slike (ubacivanje fajlova)");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const up = async (name, bytes, type) => s.act("uploadImageAction", { form: { image: new File([bytes], name, { type }) } }, { path: "/admin/slike" });
r = await up("tacka.png", png, "image/png");
const okSrc = r.value?.src;
check("pos", "ubacivanje PNG slike", r.value?.ok === true && /^\/media\/[a-z0-9-]+\.webp$/.test(okSrc ?? ""), short(r.value));
r = await anon.get(okSrc ?? "/media/x.webp");
check("pos", "ubačena slika se služi kao WebP", r.status === 200 && r.headers.get("content-type") === "image/webp", `status ${r.status} ${r.headers.get("content-type")}`);
r = await up("skripta.php", Buffer.from("<?php system($_GET['c']); ?>"), "image/png");
check("sec", "PHP fajl predstavljen kao slika se odbija", r.value?.ok === false, short(r.value));
r = await up("lazna.png", Buffer.concat([png.subarray(0, 8), Buffer.from("<?php echo 1; ?>".repeat(50))]), "image/png");
check("sec", "fajl sa PNG zaglavljem i PHP sadržajem se odbija", r.value?.ok === false, short(r.value));
r = await up("stranica.html", Buffer.from("<html><script>alert(1)</script></html>"), "text/html");
check("sec", "HTML fajl se odbija", r.value?.ok === false, short(r.value));
r = await up("../../../../tmp/hak.png", png, "image/png");
check("sec", "ime fajla sa ../ ne izlazi iz foldera za slike", r.value?.ok === true && /^\/media\/slika-[a-z0-9]+-full\.webp$/.test(r.value.src), short(r.value));
r = await up("zlo.svg", Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)"><script>alert(1)</script><foreignObject><iframe src="javascript:alert(2)"/></foreignObject></svg>`), "image/svg+xml");
const svgSrc = r.value?.src;
const svg = svgSrc ? await anon.get(svgSrc) : null;
check("sec", "SVG sa skriptom: služi se sa zabranom izvršavanja (CSP sandbox)", !svg || (/sandbox/.test(svg.headers.get("content-security-policy") ?? "") && svg.headers.get("x-content-type-options") === "nosniff"), svg ? `primljen; CSP: ${svg.headers.get("content-security-policy")}; skripta ostaje u fajlu: ${/<script>/.test(svg.text)}` : `odbijen: ${short(r.value)}`);
r = await up("bomba.png", Buffer.concat([png.subarray(0, 8), Buffer.alloc(100)]), "image/png");
check("neg", "oštećena slika daje poruku, ne grešku servera", r.status < 500 && r.value?.ok === false, `status ${r.status} ${short(r.value ?? r.error)}`);
const anonUp = await anon.act("uploadImageAction", { form: { image: new File([png], "a.png", { type: "image/png" }) } }, { path: "/admin/slike" });
check("sec", "ubacivanje slike bez prijave se odbija", !anonUp.value?.ok, `status ${anonUp.status} redirect ${anonUp.redirect} ${short(anonUp.value)}`);
r = await s.act("deleteImageAction", { form: { src: "/media/../../.env.local" } }, { path: "/admin/slike" });
check("sec", "brisanje „slike“ sa putanjom ../.env.local ne briše fajl", existsSync(new URL("../app/.env.local", import.meta.url)), r.redirect);
r = await s.act("deleteImageAction", { form: { src: okSrc } }, { path: "/admin/slike" });
check("pos", "brisanje nekorišćene slike", (await anon.get(okSrc)).status === 404, r.redirect);

section("Panel: uvoz proizvoda iz CSV-a");
const csv = (text) => new File([text], "uvoz.csv", { type: "text/csv" });
r = await s.act("startImportAction", { form: { file: csv("ovo nije csv proizvoda\n1,2,3") } }, { path: "/admin/proizvodi/uvoz" });
check("neg", "nepoznat CSV se odbija", /nije prepoznat/.test(errOf(r)), errOf(r));
r = await s.act("startImportAction", { form: { file: csv("") } }, { path: "/admin/proizvodi/uvoz" });
check("neg", "prazan fajl se odbija", /Izaberite/.test(errOf(r)), errOf(r));
const shopify = `Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Price,Variant Compare At Price,Image Src,Status
uvezen-sto,Uvezen Sto,"<p>Opis <script>alert('uvoz')</script></p>",V,Stolovi,,TRUE,Title,Default Title,US-1,5000,shopify,7,"12000",,http://127.0.0.1:3999/slika-lokalna.png,active
uvezen-ssrf,Uvezen SSRF,opis,V,Stolovi,,TRUE,Title,Default Title,US-2,100,shopify,1,"500",,http://localhost:8889/,active
uvezen-ssrf2,Uvezen SSRF2,opis,V,Stolovi,,TRUE,Title,Default Title,US-3,100,shopify,1,"500",,http://[::1]:3999/x.png,active
uvezen-ssrf3,Uvezen SSRF3,opis,V,Stolovi,,TRUE,Title,Default Title,US-4,100,shopify,1,"500",,file:///etc/passwd,active
uvezen-ssrf4,Uvezen SSRF4,opis,V,Stolovi,,TRUE,Title,Default Title,US-5,100,shopify,1,"-500",,http://2130706433:3999/x.png,active
uvezen-ssrf5,Uvezen SSRF5,opis,V,Stolovi,,TRUE,Title,Default Title,US-6,100,shopify,-4,"99999999999",,http://0x7f.0.0.1:3999/x.png,active
`;
r = await s.act("startImportAction", { form: { file: csv(shopify) } }, { path: "/admin/proizvodi/uvoz" });
check("pos", "Shopify CSV se čita", r.redirect === "/admin/proizvodi/uvoz", r.redirect ?? errOf(r));
r = await s.get("/admin/proizvodi/uvoz");
check("pos", "pregled uvoza pre upisa", /Uvezen Sto/.test(r.text), `status ${r.status}`);
const hooksBefore = hooks.length;
const countBefore = (await q("SELECT COUNT(*) c FROM products"))[0].c;
const imp = await s.act("applyImportAction", { form: { images: "on" } }, { path: "/admin/proizvodi/uvoz", raw: true });
const impRedirect = decodeURIComponent(imp.headers.get("x-action-redirect") ?? "");
const countAfter = (await q("SELECT COUNT(*) c FROM products"))[0].c;
check("sec", "uvoz ne preuzima slike sa lokalnih adresa (127.0.0.1, localhost, ::1, decimalni i heksa zapis, file://)", hooks.length === hooksBefore, `zahteva ka lokalnom prijemniku: ${hooks.slice(hooksBefore).map((h) => h.url).join(", ") || "0"}`);
check("pos", "uvoz završava bez greške servera", imp.status < 500 && /Uvezeno/.test(impRedirect), `HTTP ${imp.status}; ${impRedirect.slice(0, 200) || short(imp.text, 150)}`);
check("sec", "katalog je posle uvoza ceo", countAfter >= countBefore, `${countBefore} → ${countAfter}`);
const imported = await q("SELECT slug, price, stock_qty, description FROM products WHERE slug LIKE 'uvezen-%'");
note(`uvezeno: ${imported.map((p) => `${p.slug} cena=${p.price} stanje=${p.stock_qty}`).join("; ") || "ništa"}`);
r = await anon.get("/proizvod/uvezen-sto");
check("sec", "HTML opis iz uvoza se ne izvršava na sajtu", !/<script>alert\('uvoz'\)<\/script>/.test(r.text), `status ${r.status}`);

section("Panel: stranice, blog, kolekcije");
r = await s.act("createPageAction", { form: { title: "Akcije <script>alert(9)</script>" } }, { path: "/admin/stranice/nova" });
const pageSlug = r.redirect?.split("/").pop();
check("pos", "nova stranica (nacrt)", /^\/admin\/stranice\//.test(r.redirect ?? ""), r.redirect);
r = await anon.get(`/${pageSlug}`);
check("sec", "stranica u nacrtu se ne vidi na sajtu", r.status === 404, `status ${r.status}`);
r = await s.act("savePageAction", [{ slug: pageSlug, title: "Akcije", seoTitle: "", seoDescription: "", published: true, showInFooter: true, sections: [{ id: "a1", type: "text", data: { title: "Naslov", text: `Tekst <img src=x onerror=alert(8)> [link](javascript:alert(7))`, body: `<script>alert(6)</script>` } }, { id: "a2", type: "nepostojeca-vrsta", data: { x: 1 } }, "smece", null] }], { path: `/admin/stranice/${pageSlug}` });
check("pos", "čuvanje i objava stranice (nepoznate sekcije se odbacuju)", r.value?.ok === true, short(r.value));
r = await anon.get(`/${pageSlug}`);
check("pos", "objavljena stranica se vidi", r.status === 200, `status ${r.status}`);
check("sec", "sadržaj stranice ne ubacuje skriptu ni javascript: link", !/<img src=x onerror=alert\(8\)>|<script>alert\(6\)<\/script>|href="javascript:/i.test(r.text), short(r.text.match(/href="javascript:[^"]*"/i)?.[0] ?? ""));
for (const title of ["admin", "api", "kolekcija", "nalog", "media"]) {
  r = await s.act("createPageAction", { form: { title } }, { path: "/admin/stranice/nova" });
  const made = r.redirect?.split("/").pop();
  check("sec", `stranica sa naslovom „${title}“ ne zauzima rezervisanu adresu`, made !== title, `adresa: ${made}`);
}
r = await s.act("createPostAction", { form: { title: "Prvi članak" } }, { path: "/admin/blog" });
const postId = r.redirect?.split("/").pop();
check("pos", "nov članak na blogu", /^\/admin\/blog\/\d+$/.test(r.redirect ?? ""), r.redirect);
r = await s.act("savePostAction", { form: { id: postId, title: "Prvi članak", slug: "prvi-clanak", excerpt: "Kratko", body: `## Naslov\n\nTekst sa [linkom](javascript:alert(1)) i <script>alert('blog')</script>\n\n![slika](x" onerror="alert(2))`, author: "Vlasnik", tags: "novo, <b>tag</b>", status: "published", publishedAt: "" } }, { path: `/admin/blog/${postId}` });
check("pos", "objava članka", /ok=/.test(r.redirect ?? ""), r.redirect);
r = await anon.get("/blog/prvi-clanak");
check("pos", "članak se vidi na sajtu", r.status === 200 && /Prvi članak/.test(r.text), `status ${r.status}`);
check("sec", "tekst članka ne ubacuje skriptu, javascript: link ni onerror", !/<script>alert\('blog'\)<\/script>|href="javascript:|onerror="alert/i.test(r.text), short(r.text.match(/href="javascript:[^"]*"|onerror="[^"]*"/i)?.[0] ?? ""));
r = await s.act("savePostAction", { form: { id: postId, title: "Prvi članak", slug: "prvi-clanak", body: "Zakazan", status: "published", publishedAt: "2099-01-01T10:00" } }, { path: `/admin/blog/${postId}` });
r = await anon.get("/blog/prvi-clanak");
check("pos", "članak zakazan za 2099. se ne vidi do tada", r.status === 404, `status ${r.status}`);
r = await s.act("createCollectionAction", { form: { name: "Bestseleri" } }, { path: "/admin/kolekcije" });
r = await s.act("saveCollectionAction", { form: { id: "bestseleri", name: "Bestseleri", description: "Opis", products: ["stolica-test", "nacrt-proizvod", "nepostoji"] } }, { path: "/admin/kolekcije/bestseleri" });
r = await anon.api?.("/collections/bestseleri") ?? await new Session().api("/collections/bestseleri");
check("pos", "kolekcija preko API-ja: nacrt i nepostojeći proizvod se ne vide", r.json?.products?.length === 1 && r.json.products[0].slug === "stolica-test", short(r.json?.products?.map((p) => p.slug)));

section("Panel: brisanje i posledice");
r = await s.act("deleteCategoryAction", { form: { id: "stolice" } }, { path: "/admin/kategorije" });
const orphan = await q("SELECT id, parent FROM categories");
const stProd = (await q("SELECT category FROM products WHERE slug='stolica-test'"))[0];
note(`posle brisanja kategorije „stolice“: kategorije ${JSON.stringify(orphan)}, proizvod.category=„${stProd.category}“ (${errOf(r) || r.redirect})`);
check("pos", "brisanje kategorije ne ostavlja podkategoriju sa nepostojećim roditeljem", !orphan.some((c) => c.parent && !orphan.some((p) => p.id === c.parent)), JSON.stringify(orphan));
r = await s.act("deleteProductAction", { form: { slug: "lampa-akcija" } }, { path: "/admin/proizvodi" });
r = await s.get(`/admin/porudzbine/${state.first}`);
check("pos", "porudžbina sa obrisanim proizvodom se i dalje otvara", r.status === 200 && /Lampa Akcija/.test(r.text), `status ${r.status}`);
r = await new Session().api("/cart", { method: "POST", body: { items: [{ slug: "lampa-akcija", qty: 1 }] } });
check("pos", "obrisan proizvod ispada iz korpe kupca", r.json?.removed?.includes("lampa-akcija"), short(r.json?.removed));
r = await s.act("deleteDiscountAction", { form: { id: "leto" } }, { path: "/admin/popusti" });
r = await s.get(`/admin/porudzbine/${state.mine}`);
check("pos", "porudžbina sa obrisanim popustom se i dalje otvara", r.status === 200, `status ${r.status}`);
r = await s.act("bulkProductsAction", { form: { slugs: ["deset-komada", "poslednji-komad"], operation: "price", percent: "-100" } }, { path: "/admin/proizvodi" });
check("neg", "izmena cena za −100% se odbija", /procenat/.test(errOf(r)), errOf(r));
r = await s.act("bulkProductsAction", { form: { slugs: ["hex-zapis"], operation: "price", percent: "1000" } }, { path: "/admin/proizvodi" });
r = await s.act("bulkProductsAction", { form: { slugs: ["naucni-zapis", "hex-zapis", "stolica-test-2", "bez-cene"], operation: "delete" } }, { path: "/admin/proizvodi" });
check("pos", "brisanje više proizvoda odjednom", (await q("SELECT COUNT(*) c FROM products WHERE slug IN ('naucni-zapis','hex-zapis','stolica-test-2','bez-cene')"))[0].c === 0, r.redirect);

section("Webhook-ovi (lokalni prijemnik)");
r = await s.act("createWebhookAction", { form: { url: "ftp://127.0.0.1/x", events: ["order.created"] } }, { path: "/admin/integracije" });
check("neg", "webhook sa ftp:// adresom se odbija", /Adresa/.test(errOf(r)), errOf(r));
r = await s.act("createWebhookAction", { form: { url: "http://127.0.0.1:3999/hook", events: [] } }, { path: "/admin/integracije" });
check("neg", "webhook bez događaja se odbija", /događaj/.test(errOf(r)), errOf(r));
r = await s.act("createWebhookAction", { form: { url: "http://127.0.0.1:3999/hook", events: ["order.created", "order.status", "order.paid", "order.refunded", "izmisljen"] } }, { path: "/admin/integracije" });
check("pos", "dodavanje webhook-a", /ok=/.test(r.redirect ?? ""), r.redirect);
note("webhook adresa je lokalna (127.0.0.1) i panel je prihvata: vlasnik može da gađa i unutrašnju mrežu servera — prihvatljivo jer je samo za vlasnika");
const hook = (await q("SELECT id, secret FROM webhooks LIMIT 1"))[0];
r = await s.act("testWebhookAction", { form: { id: hook.id } }, { path: "/admin/integracije" });
check("pos", "proba webhook-a stiže", /Proba je stigla/.test(decodeURIComponent(r.redirect ?? "")) && hooks.some((h) => h.headers["x-shopcrm-event"] === "ping"), r.redirect);
const h0 = hooks.length;
const ord = await new Session().api("/orders", { method: "POST", body: { customer: { name: "Webhook Kupac", phone: "063 777 0001", email: "hook@example.test", street: "Ulica 9", city: "Beograd", postalCode: "11000", note: "" }, items: [{ slug: "deset-komada", qty: 1 }] } });
await wait(1500);
const got = hooks.slice(h0).find((h) => h.headers["x-shopcrm-event"] === "order.created");
const valid = got && got.headers["x-shopcrm-signature"] === `sha256=${createHmac("sha256", hook.secret).update(got.body).digest("hex")}`;
check("pos", "webhook order.created stiže sa ispravnim potpisom", !!valid, got ? `potpis ${got.headers["x-shopcrm-signature"]?.slice(0, 20)}…` : "nije stigao");
check("sec", "webhook ne šalje internu belešku ni ključ kupca", got && !/adminNote|customerKey|emailError/.test(got.body), short(got?.body, 120));

section("API sa ključem (/api/v1/admin)");
const api = new Session();
const auth = (key) => ({ authorization: `Bearer ${key}` });
r = await api.api("/admin/orders", { headers: auth(keys.read) });
check("pos", "GET /admin/orders sa ključem za čitanje", r.status === 200 && r.json?.orders?.length > 5, `status ${r.status}, porudžbina: ${r.json?.orders?.length}`);
check("sec", "odgovor ne sadrži interne beleške", !/adminNote|customerKey/.test(r.text), "");
r = await api.api(`/admin/orders/${state.first}`, { headers: auth(keys.read) });
check("pos", "GET /admin/orders/{broj}", r.status === 200 && r.json?.order?.number === String(state.first), `status ${r.status}`);
r = await api.api("/admin/orders?status=new&limit=2&since=2020-01-01", { headers: auth(keys.read) });
check("pos", "filteri ?status=&limit=&since=", r.status === 200 && r.json?.orders?.length === 2 && r.json.orders.every((o) => o.status === "new"), `${r.json?.orders?.length}`);
r = await api.api("/admin/orders?limit=-5&since=nije-datum&status=%27", { headers: auth(keys.read) });
check("neg", "neispravni filteri ne ruše API", r.status === 200, `status ${r.status}`);
r = await api.api("/admin/products", { headers: auth(keys.read) });
check("pos", "GET /admin/products (sa nacrtima i stanjem)", r.status === 200 && r.json?.products?.some((p) => p.active === false), `status ${r.status}`);
for (const [title, headers] of [["bez ključa", {}], ["pogrešan ključ", auth("sk_" + "0".repeat(48))], ["ključ pogrešnog oblika", auth("sk_kratak")], ["Basic umesto Bearer", { authorization: "Basic " + Buffer.from(keys.read).toString("base64") }], ["ključ u adresi ?key=", {}], ["SQL u ključu", auth("sk_' OR 1=1 --")]]) {
  r = await new Session().api("/admin/orders" + (title.includes("adresi") ? `?key=${keys.read}&api_key=${keys.read}` : ""), { headers });
  check("sec", `/admin/orders: ${title} → 401`, r.status === 401, `status ${r.status}`);
}
r = await api.api(`/admin/orders/${state.first}/status`, { method: "POST", headers: auth(keys.read), body: { status: "cancelled" } });
check("sec", "ključ samo za čitanje ne može da menja status → 403", r.status === 403 && (await orderRow(state.first)).status === "new", `status ${r.status}`);
r = await api.api("/admin/products/stolica-test/stock", { method: "POST", headers: auth(keys.read), body: { qty: 999 } });
check("sec", "ključ samo za čitanje ne može da menja stanje → 403", r.status === 403, `status ${r.status}`);
r = await api.api(`/admin/orders/${state.first}/status`, { method: "POST", headers: auth(keys.write), body: { status: "confirmed", notify: false } });
check("pos", "ključ sa izmenama menja status", r.status === 200 && r.json?.order?.status === "confirmed", `status ${r.status}`);
r = await api.api(`/admin/orders/${state.first}/status`, { method: "POST", headers: auth(keys.write), body: { status: "hakovana" } });
check("neg", "nepoznat status → 400", r.status === 400, `status ${r.status} ${short(r.json)}`);
r = await api.api(`/admin/orders/999999/status`, { method: "POST", headers: auth(keys.write), body: { status: "confirmed" } });
check("neg", "nepostojeća porudžbina → 404", r.status === 404, `status ${r.status}`);
r = await api.api(`/admin/orders/${state.first}/tracking`, { method: "POST", headers: auth(keys.write), body: { number: "API-1", url: "javascript:alert(1)" } });
check("sec", "tracking url „javascript:“ → 400", r.status === 400, `status ${r.status}`);
r = await api.api(`/admin/orders/${state.first}/tracking`, { method: "POST", headers: auth(keys.write), body: { number: "API-1", url: "https://kurir.example/API-1" } });
check("pos", "upis broja pošiljke preko API-ja", r.status === 200 && r.json?.order?.tracking?.number === "API-1", `status ${r.status}`);
for (const qty of [-1, 1.5, "abc", 1e9, {}, [5]]) {
  r = await api.api("/admin/products/stolica-test/stock", { method: "POST", headers: auth(keys.write), body: { qty } });
  check("neg", `stanje qty=${JSON.stringify(qty)} → 400`, r.status === 400, `status ${r.status} → stanje ${await stock("stolica-test")}`);
}
r = await api.api("/admin/products/stolica-test/stock", { method: "POST", headers: auth(keys.write), body: {} });
check("neg", "stanje bez polja qty → 400 (ne menja stanje)", r.status === 400, `status ${r.status} ${short(r.json)} → stanje u bazi ${await stock("stolica-test")}`);
r = await api.api("/admin/products/stolica-test/stock", { method: "POST", headers: auth(keys.write), body: { qty: 20 } });
check("pos", "upis stanja preko API-ja", r.status === 200 && (await stock("stolica-test")) === 20, `status ${r.status}`);
r = await api.api("/admin/products/fotelja-varijante/stock", { method: "POST", headers: auth(keys.write), body: { qty: 3, variant: "crvena-orah" } });
check("pos", "upis stanja varijante preko API-ja", r.status === 200 && (await q("SELECT stock_qty FROM product_variants WHERE id='crvena-orah'"))[0].stock_qty === 3, `status ${r.status}`);
r = await api.api("/admin/products/nepostoji/stock", { method: "POST", headers: auth(keys.write), body: { qty: 3 } });
check("neg", "stanje nepostojećeg proizvoda → 404", r.status === 404, `status ${r.status}`);
// Nagađanje ključa
const guess = new Session("10.252.0.1");
let keyLimit = null;
for (let i = 1; i <= 25; i++) { const g = await guess.api("/admin/orders", { headers: auth("sk_" + String(i).padStart(48, "0")) }); if (g.status === 429) { keyLimit = i; break; } }
check("sec", "nagađanje API ključa se ograničava (429 posle 20)", keyLimit === 21, `429 na pokušaju ${keyLimit}`);
r = await guess.api("/admin/orders", { headers: auth(keys.read) });
check("pos", "ispravan ključ radi i sa adrese koja je blokirana zbog nagađanja", r.status === 200, `status ${r.status}`);
// Isključivanje API-ja
const keyId = (await q("SELECT id FROM api_keys WHERE scope='read'"))[0].id;
await s.act("deleteApiKeyAction", { form: { id: keyId } }, { path: "/admin/integracije" });
r = await api.api("/admin/orders", { headers: auth(keys.read) });
check("sec", "obrisan ključ odmah prestaje da važi", r.status === 401, `status ${r.status}`);
await s.act("saveAccessAction", { form: { publicApi: "on", webhooks: "on" } }, { path: "/admin/integracije" });
r = await api.api("/admin/orders", { headers: auth(keys.write) });
check("sec", "isključen API sa ključem → 403 i sa ispravnim ključem", r.status === 403, `status ${r.status}`);
await s.act("saveAccessAction", { form: { publicApi: "on", adminApi: "on", webhooks: "on" } }, { path: "/admin/integracije" });

section("Cron");
r = await anon.get("/api/v1/cron");
check("sec", "/api/v1/cron bez ključa → 404", r.status === 404, `status ${r.status}`);
r = await anon.get("/api/v1/cron?key=pogresan");
check("sec", "/api/v1/cron sa pogrešnim ključem → 404", r.status === 404, `status ${r.status}`);
r = await anon.get("/api/v1/cron?key=test-cron-secret-123");
check("pos", "/api/v1/cron sa ispravnim ključem", r.status === 200 && /reminders/.test(r.text), `status ${r.status} ${short(r.text, 60)}`);

writeFileSync(new URL("../state.json", import.meta.url), JSON.stringify({ ...state, manual, hookSecret: hook.secret }));
receiver.close();
await done();
process.exit(0);
