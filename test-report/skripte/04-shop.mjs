import { readFileSync, existsSync } from "node:fs";
import { Session, check, section, done, q, short, note } from "./h.mjs";
const state = JSON.parse(readFileSync(new URL("../state.json", import.meta.url)));
const mails = () => (existsSync(new URL("../mails.jsonl", import.meta.url)) ? readFileSync(new URL("../mails.jsonl", import.meta.url), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const decode = (data) => data.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

section("Prodavnica: stranice se otvaraju");
const anon = new Session();
const pages = ["/", "/kolekcija", "/kolekcija/stolice", "/proizvod/stolica-test", "/proizvod/fotelja-varijante", "/placanje", "/nalog", "/nalog/lozinka", "/pracenje", "/lista-zelja", "/blog", "/o-nama", "/pitanja", "/kontakt", "/sitemap.xml", "/robots.txt", "/sdk.js", "/demo.html", "/en", "/en/collection", "/en/product/stolica-test", "/en/checkout", "/en/account", "/api/theme/default.css"];
for (const path of pages) {
  const r = await anon.get(path);
  check("pos", `GET ${path}`, r.status === 200 && r.text.length > 200 && !/Application error|Internal Server Error/.test(r.text), `status ${r.status}, ${r.text.length} bajtova`);
}
for (const path of ["/proizvod/nepostoji", "/proizvod/nacrt-proizvod", "/kolekcija/nepostoji", "/nepostojeca-stranica", "/blog/nepostoji", "/de", "/en/proizvod/nepostoji", "/korpa/odjava/x", "/media/../../.env.local", "/media/..%2F..%2F.env.local", "/media/%2e%2e%2f.env.local", "/media/x.php", "/api/theme/..%2F..%2Fpackage.json", "/.env.local", "/.env", "/.git/config", "/package.json", "/storage/uploads/", "/lib/db.ts", "/next.config.ts", "/keys-last.json", "/admin/../.env.local"]) {
  const r = await anon.get(path);
  check(path.includes("env") || path.includes("git") || path.includes("media") || path.includes("json") || path.includes("lib") || path.includes("config") || path.includes("storage") ? "sec" : "neg", `GET ${path} → 404`, r.status === 404 || (r.status === 200 && /name="password"|name="repeat"/.test(r.text) && !/DB_PASSWORD/.test(r.text)), `status ${r.status} ${short(r.text.replace(/\s+/g, " "), 60)}`);
}
let r = await anon.get("/proizvod/nacrt-proizvod");
check("sec", "nacrt proizvoda se ne vidi na sajtu", r.status === 404 && !/Nacrt Proizvod/.test(r.text), `status ${r.status}`);
r = await anon.get("/sitemap.xml");
check("sec", "sitemap ne sadrži nacrte ni panel", !/nacrt-proizvod|\/admin/.test(r.text), short(r.text.match(/<loc>[^<]*<\/loc>/g)?.slice(0, 6).join(" ")));
r = await anon.get("/robots.txt");
note(`robots.txt: ${r.text.replace(/\n/g, " | ")}`);

section("Prodavnica: XSS (HTML koji je uneo vlasnik ili kupac)");
const xssPaths = ["/proizvod/img-src-x-onerror-alert-1-xss", "/kolekcija", "/", "/kolekcija?q=%3Cscript%3Ealert(1)%3C/script%3E", "/pracenje?broj=%3Cscript%3Ealert(1)%3C/script%3E", "/nalog?greska=%3Cimg%20src=x%20onerror=alert(1)%3E", "/placanje/uplata?porudzbina=%3Cscript%3Ealert(1)%3C/script%3E&ishod=uspeh", "/admin?greska=%3Cscript%3Ealert(1)%3C/script%3E", "/kolekcija?sort=%22%3E%3Csvg/onload=alert(1)%3E"];
for (const path of xssPaths) {
  r = await anon.get(path);
  // Sirov, neizbegnut HTML napadača u odgovoru (van JSON-a za hidrataciju, gde je < zapisan kao <).
  const raw = /<script>alert\(\d\)<\/script>|<img src=x onerror=alert\(1\)>|<svg onload=alert\(4\)>|<svg\/onload=alert\(1\)>|<iframe src=javascript:alert\(5\)>/.test(r.text);
  check("sec", `bez sirovog HTML-a napadača: ${path.slice(0, 60)}`, !raw, `status ${r.status}${raw ? " — NEIZBEGNUT HTML U STRANICI" : ""}`);
}
r = await anon.get("/proizvod/img-src-x-onerror-alert-1-xss");
const ld = r.text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "";
check("sec", "podaci za Google (ld+json) ne mogu da zatvore <script> oznaku", !/<\/script|<script/i.test(ld) && ld.length > 0, `ld+json ${ld.length} znakova; ${short(ld.match(/.{0,30}script.{0,30}/i)?.[0] ?? "nema „script“ u sirovom obliku")}`);

section("Nalog kupca");
const user = new Session();
const reg = { firstName: "Mira", lastName: "Kupac", email: "mira@example.test", password: "Tajna-lozinka-1", news: true };
r = await user.act("registerAction", [{ ...reg, password: "kratka" }], { path: "/nalog" });
check("neg", "registracija sa kratkom lozinkom", r.value?.ok === false && !!r.value?.errors?.password, short(r.value));
r = await user.act("registerAction", [{ ...reg, email: "nije-email" }], { path: "/nalog" });
check("neg", "registracija sa neispravnim emailom", r.value?.ok === false && !!r.value?.errors?.email, short(r.value));
r = await user.act("registerAction", [{ ...reg, firstName: "", lastName: "" }], { path: "/nalog" });
check("neg", "registracija bez imena", r.value?.ok === false, short(r.value));
r = await user.act("registerAction", [null], { path: "/nalog" });
check("neg", "registracija sa null umesto podataka ne ruši server", r.status < 500, `status ${r.status} ${short(r.value ?? r.error)}`);
r = await user.act("registerAction", [reg], { path: "/nalog" });
check("pos", "registracija", r.value?.ok === true && user.cookies.has("demoshop-session"), short(r.value));
r = await new Session().act("registerAction", [{ ...reg, email: "MIRA@example.test" }], { path: "/nalog" });
check("neg", "registracija sa istom adresom (velika slova)", r.value?.ok === false, short(r.value));
const hash = (await q("SELECT pass_hash FROM shop_users WHERE email='mira@example.test'"))[0]?.pass_hash ?? "";
check("sec", "lozinka kupca je u bazi kao scrypt heš", hash.startsWith("scrypt$") && !hash.includes("Tajna"), hash.slice(0, 20));
r = await user.get("/nalog");
check("pos", "stranica naloga prijavljenog kupca", r.status === 200 && /Mira/.test(r.text), `status ${r.status}`);
r = await user.act("logoutAction", [], { path: "/nalog" });
check("pos", "odjava", !user.cookies.has("demoshop-session"), [...user.cookies.keys()].join());
r = await user.act("loginAction", [{ email: "mira@example.test", password: "pogresna", remember: false }], { path: "/nalog" });
check("neg", "prijava pogrešnom lozinkom", r.value?.ok === false, short(r.value));
r = await user.act("loginAction", [{ email: "' OR 1=1 --@x.y", password: "x", remember: false }], { path: "/nalog" });
check("sec", "SQL injection u prijavi kupca", r.value?.ok === false, short(r.value));
r = await user.act("loginAction", [{ email: { $ne: "" }, password: { $ne: "" }, remember: true }], { path: "/nalog" });
check("sec", "objekti umesto teksta u prijavi", r.value?.ok === false && r.status < 500, `status ${r.status} ${short(r.value)}`);
r = await user.act("loginAction", [{ email: "Mira@Example.test", password: "Tajna-lozinka-1", remember: true }], { path: "/nalog" });
check("pos", "prijava ispravnom lozinkom", r.value?.ok === true && user.cookies.has("demoshop-session"), short(r.value));
r = await user.act("saveAddressAction", [{ phone: "064 555 1234", street: "Nova 5", city: "Novi Sad", postalCode: "21000" }], { path: "/nalog" });
check("pos", "čuvanje adrese uz nalog", r.value?.ok === true, short(r.value));
r = await anon.act("saveAddressAction", [{ phone: "1", street: "x", city: "y", postalCode: "1" }], { path: "/nalog" });
check("sec", "čuvanje adrese bez prijave se odbija", r.value?.ok === false, short(r.value));

section("Poručivanje sa sajta (server akcije)");
const customer = { email: "mira@example.test", phone: "064 555 1234", firstName: "Mira", lastName: "Kupac", address: "Nova 5", city: "Novi Sad", zip: "21000", note: "Zvono ne radi" };
r = await user.act("quoteAction", [{ items: [{ slug: "stolica-test", qty: 1 }], promoCode: "LETO10", delivery: "kurir", zip: "21000" }], { path: "/placanje" });
check("pos", "obračun na stranici plaćanja: 10000 − 1000 + 500", r.value?.total === 9500, short(r.value));
r = await user.act("placeOrderAction", [{ customer, items: [{ slug: "stolica-test", qty: 1 }], promoCode: "LETO10", payment: "cod", delivery: "kurir" }], { path: "/placanje" });
const mine = r.value?.order?.number;
check("pos", "porudžbina prijavljenog kupca", r.value?.ok === true && r.value?.order?.total === 9500, short(r.value, 400));
r = await user.act("placeOrderAction", [{ customer: { ...customer, firstName: "", email: "x" }, items: [{ slug: "stolica-test", qty: 1 }], promoCode: "", payment: "cod", delivery: "kurir" }], { path: "/placanje" });
check("neg", "porudžbina sa praznim imenom i lošim emailom vraća greške po poljima", r.value?.ok === false && r.value?.errors?.firstName && r.value?.errors?.email, short(r.value));
r = await user.act("placeOrderAction", [null], { path: "/placanje" });
check("neg", "porudžbina sa null ne ruši server", r.status < 500 && r.value?.ok === false, `status ${r.status} ${short(r.value ?? r.error)}`);
r = await user.act("placeOrderAction", [{ customer, items: [{ slug: "stolica-test", qty: 1, variantId: { a: 1 } }, { slug: 5, qty: "x" }], promoCode: ["a"], payment: {}, delivery: 5 }], { path: "/placanje" });
check("neg", "porudžbina sa pogrešnim tipovima ne ruši server", r.status < 500, `status ${r.status} ${short(r.value ?? r.error)}`);
r = await user.get("/nalog");
check("pos", "porudžbina se vidi u nalogu kupca", new RegExp(`#?${mine}`).test(r.text), `traži ${mine}`);
r = await user.get(`/nalog/racun/${mine}`);
check("pos", "račun u PDF-u za svoju porudžbinu", r.status === 200 && r.headers.get("content-type") === "application/pdf" && r.text.startsWith("%PDF"), `status ${r.status} ${r.headers.get("content-type")}`);
r = await user.get(`/nalog/racun/${state.first}`);
check("sec", "račun tuđe porudžbine → 404 (IDOR)", r.status === 404, `status ${r.status}`);
r = await anon.get(`/nalog/racun/${mine}`);
check("sec", "račun bez prijave → 404", r.status === 404, `status ${r.status}`);
for (const n of [`${mine} OR 1=1`, "1001%27", "-1", "99999999999", "1e3"]) {
  r = await user.get(`/nalog/racun/${n}`);
  check("sec", `račun sa brojem „${n}" → 404`, r.status === 404, `status ${r.status}`);
}

section("Praćenje porudžbine i povrat");
r = await anon.act("trackOrderAction", [{ number: String(mine), email: "mira@example.test" }], { path: "/pracenje" });
check("pos", "praćenje po broju i email adresi", r.value?.ok === true && r.value?.order?.number === String(mine), short(r.value, 200));
r = await anon.act("trackOrderAction", [{ number: `#${mine}`, email: " MIRA@example.test " }], { path: "/pracenje" });
check("pos", "praćenje sa # i velikim slovima u adresi", r.value?.ok === true, short(r.value, 120));
r = await anon.act("trackOrderAction", [{ number: String(mine), email: "neko@example.test" }], { path: "/pracenje" });
check("sec", "praćenje sa pogrešnom adresom ne otkriva porudžbinu", r.value?.ok === false, short(r.value));
r = await anon.act("trackOrderAction", [{ number: String(state.first), email: "%" }], { path: "/pracenje" });
check("sec", "praćenje sa džokerom % umesto adrese", r.value?.ok === false, short(r.value));
r = await user.act("trackOrderAction", [{ number: String(state.first), email: "" }], { path: "/pracenje" });
check("sec", "prijavljen kupac ne vidi tuđu porudžbinu bez adrese", r.value?.ok === false, short(r.value));
r = await anon.act("trackOrderAction", [{ number: { toString: 1 }, email: ["a"] }], { path: "/pracenje" });
check("neg", "praćenje sa objektima umesto teksta", r.status < 500 && r.value?.ok === false, `status ${r.status} ${short(r.value ?? r.error)}`);
r = await anon.act("returnRequestAction", [{ number: String(mine), email: "mira@example.test", items: [{ position: 0, qty: 1 }], reason: "Ne odgovara mi boja." }], { path: "/pracenje" });
check("neg", "povrat za porudžbinu koja još nije poslata se odbija", r.value?.ok === false, short(r.value));
// Enumeracija brojeva porudžbina: ograničenje po adresi
const en = new Session("10.251.0.1");
let trackLimit = null;
for (let i = 1; i <= 25; i++) {
  const t = await en.act("trackOrderAction", [{ number: String(1000 + i), email: "x@example.test" }], { path: "/pracenje" });
  if (/Previše/.test(t.value?.error ?? "")) { trackLimit = i; break; }
}
check("sec", "nagađanje porudžbina se ograničava (20 pokušaja)", trackLimit === 21, `blokada na ${trackLimit}`);

section("Plaćanje karticom (probni procesor)");
const pay = new URL(state.payUrl);
r = await anon.get(pay.pathname + pay.search);
check("pos", "stranica probnog plaćanja se otvara sa ispravnim potpisom", r.status === 200 && /ishod=uspeh/.test(r.text), `status ${r.status}`);
const okLink = decodeURIComponent(r.text.match(/\/api\/v1\/payments\/test\?porudzbina=[^"&]*&(?:amp;)?ishod=uspeh&(?:amp;)?potpis=[0-9a-f]+/)?.[0] ?? "").replace(/&amp;/g, "&");
const noLink = okLink.replace("ishod=uspeh", "ishod=odbijeno");
r = await anon.get(pay.pathname + pay.search.replace(/potpis=\w{4}/, "potpis=0000"));
check("sec", "probno plaćanje sa izmenjenim potpisom → 404", r.status === 404, `status ${r.status}`);
r = await anon.get(pay.pathname + pay.search.replace(`porudzbina=${state.cardOrder}`, `porudzbina=${state.first}`));
check("sec", "potpis jedne porudžbine ne važi za drugu", r.status === 404, `status ${r.status}`);
r = await anon.get(`/api/v1/payments/test?porudzbina=${state.cardOrder}&ishod=uspeh&potpis=${"0".repeat(64)}`);
check("sec", "potvrda uplate sa lažnim potpisom → 400, porudžbina nije plaćena", r.status === 400 && (await q("SELECT paid_at FROM orders WHERE number=?", [state.cardOrder]))[0].paid_at === null, `status ${r.status}`);
r = await anon.get(noLink.replace(/potpis=[0-9a-f]+/, `potpis=${okLink.match(/potpis=([0-9a-f]+)/)?.[1]}`));
check("sec", "potpis za „uspeh“ ne važi kao „odbijeno“ i obrnuto", r.status === 400, `status ${r.status}`);
r = await anon.get(`/api/v1/payments/nepostoji?porudzbina=${state.cardOrder}&ishod=uspeh&potpis=x`);
check("neg", "nepoznat procesor → 400", r.status === 400, `status ${r.status}`);
r = await anon.get(okLink);
const paid = (await q("SELECT paid_at, payment_ref FROM orders WHERE number=?", [state.cardOrder]))[0];
check("pos", "ispravna potvrda: porudžbina plaćena, kupac vraćen na stranicu ishoda", r.status === 303 && /ishod=uspeh/.test(r.location ?? "") && paid.paid_at !== null, `status ${r.status} → ${r.location}; ref ${paid.payment_ref}`);
await anon.get(okLink);
const events = await q("SELECT text FROM order_events WHERE order_number=? AND text LIKE 'Plaćeno%'", [state.cardOrder]);
check("pos", "ista potvrda dva puta upisuje uplatu samo jednom", events.length === 1, `događaja: ${events.length}`);
r = await anon.get(`/api/v1/payments/test?porudzbina=${state.cardOrder}&ishod=odbijeno&potpis=${noLink.match(/potpis=([0-9a-f]+)/)?.[1]}`);
note(`„odbijeno“ posle uspešne uplate: status ${r.status} → ${r.location} (porudžbina ostaje plaćena: ${(await q("SELECT paid_at FROM orders WHERE number=?", [state.cardOrder]))[0].paid_at !== null})`);

section("Kontakt, novosti, utisci");
r = await anon.act("contactAction", [{ name: "Pera", email: "pera@example.test", topic: "Pitanje", text: "Da li imate stolice?" }], { path: "/kontakt" });
check("pos", "kontakt forma", r.value?.ok === true, short(r.value));
r = await anon.act("contactAction", [{ name: "", email: "x", topic: "", text: "" }], { path: "/kontakt" });
check("neg", "prazna kontakt forma", r.value?.ok === false && Object.keys(r.value.errors).length === 3, short(r.value));
r = await anon.act("contactAction", [{ name: `<script>alert(1)</script>`, email: "xss@example.test", topic: `"><img src=x onerror=alert(1)>`, text: `<script>alert('poruka')</script>` + "x".repeat(6000) }], { path: "/kontakt" });
check("pos", "kontakt poruka sa HTML-om i 6000 znakova se prima (skraćena)", r.value?.ok === true, short(r.value));
r = await anon.act("contactAction", [{ name: "T", email: "t@example.test", topic: "T".repeat(120), text: "tema od 120 znakova" }], { path: "/kontakt" });
check("neg", "tema od 120 znakova (kolona u bazi je 100): poruka se prima bez greške servera", r.status < 500 && r.value?.ok === true, `status ${r.status} ${short(r.value ?? r.error)}`);
r = await anon.act("subscribeAction", ["novosti@example.test"], { path: "/" });
check("pos", "prijava na novosti", r.value?.ok === true, short(r.value));
r = await anon.act("subscribeAction", ["novosti@example.test"], { path: "/" });
check("pos", "ista adresa drugi put (bez duplikata)", r.value?.ok === true && (await q("SELECT COUNT(*) c FROM shop_subscribers WHERE email='novosti@example.test'"))[0].c === 1, short(r.value));
r = await anon.act("subscribeAction", ["nije email"], { path: "/" });
check("neg", "prijava na novosti sa neispravnom adresom", r.value?.ok === false, short(r.value));
r = await anon.act("reviewAction", [{ slug: "stolica-test", rating: 5, text: "Odlična stolica, preporuka." }], { path: "/proizvod/stolica-test" });
check("sec", "utisak bez prijave se odbija", r.value?.ok === false, short(r.value));
r = await user.act("reviewAction", [{ slug: "stolica-test", rating: 5, text: `Odlična stolica! <script>alert('utisak')</script>` }], { path: "/proizvod/stolica-test" });
check("pos", "utisak prijavljenog kupca", r.value?.ok === true, short(r.value));
for (const rating of [0, 6, -1, "abc", 1e9]) {
  r = await user.act("reviewAction", [{ slug: "stolica-test", rating, text: "Tekst utiska dovoljno dug." }], { path: "/proizvod/stolica-test" });
  check("neg", `utisak sa ocenom ${rating} se odbija`, r.value?.ok === false, short(r.value));
}
r = await user.act("reviewAction", [{ slug: "nacrt-proizvod", rating: 5, text: "Utisak za nacrt proizvoda." }], { path: "/" });
check("neg", "utisak za nacrt proizvoda se odbija", r.value?.ok === false, short(r.value));
r = await anon.get("/proizvod/stolica-test");
check("sec", "neodobren utisak se ne vidi na sajtu", !/Odlična stolica!/.test(r.text), "");
const reviews = await q("SELECT id, status, verified, name FROM reviews");
note(`utisci u bazi: ${JSON.stringify(reviews)}`);

section("Nova lozinka kupca i podmetanje adrese (Host)");
const before = mails().length;
r = await anon.act("requestResetAction", ["nepostoji@example.test"], { path: "/nalog/lozinka" });
const unknownAnswer = JSON.stringify(r.value);
r = await anon.act("requestResetAction", ["mira@example.test"], { path: "/nalog/lozinka" });
check("pos", "zahtev za novu lozinku", r.value?.ok === true, short(r.value));
check("sec", "isti odgovor za postojeću i nepostojeću adresu", unknownAnswer === JSON.stringify(r.value), `${unknownAnswer} / ${JSON.stringify(r.value)}`);
await wait(800);
let mail = mails().slice(before).find((m) => m.to.some((t) => t.includes("mira@")));
const body = mail ? decode(mail.data) : "";
const link = body.match(/https?:\/\/[^\s"<]+\/nalog\/lozinka\/[\w-]+/)?.[0];
check("pos", "email sa linkom za novu lozinku stiže samo postojećem nalogu", !!link && mails().slice(before).length === 1, `link: ${link}; poruka: ${mails().slice(before).length}`);
const token = link?.split("/").pop();
r = await anon.get(new URL(link).pathname);
check("pos", "stranica za novu lozinku se otvara", r.status === 200, `status ${r.status}`);
r = await anon.act("resetPasswordAction", ["pogresan-token", "Nova-lozinka-22"], { path: "/nalog/lozinka/x" });
check("sec", "nova lozinka sa pogrešnim žetonom", r.value?.ok === false, short(r.value));
r = await anon.act("resetPasswordAction", [token, "kratka"], { path: "/nalog/lozinka/x" });
check("neg", "nova lozinka kraća od 8", r.value?.ok === false, short(r.value));
r = await anon.act("resetPasswordAction", [token, "Nova-lozinka-22"], { path: "/nalog/lozinka/x" });
check("pos", "postavljanje nove lozinke", r.value?.ok === true, short(r.value));
r = await anon.act("resetPasswordAction", [token, "Treca-lozinka-33"], { path: "/nalog/lozinka/x" });
check("sec", "isti link ne važi drugi put", r.value?.ok === false, short(r.value));
r = await user.get("/nalog");
check("sec", "nova lozinka odjavljuje stare sesije", !/Mira/.test(r.text) || /type="password"/.test(r.text), `status ${r.status}`);
r = await user.act("loginAction", [{ email: "mira@example.test", password: "Tajna-lozinka-1", remember: false }], { path: "/nalog" });
check("sec", "stara lozinka više ne važi", r.value?.ok === false, short(r.value));
r = await user.act("loginAction", [{ email: "mira@example.test", password: "Nova-lozinka-22", remember: false }], { path: "/nalog" });
check("pos", "prijava novom lozinkom", r.value?.ok === true, short(r.value));
// Podmetnut Host: link u emailu ne sme da vodi na adresu napadača
const m2 = mails().length;
const poison = new Session();
r = await poison.act("requestResetAction", ["mira@example.test"], { path: "/nalog/lozinka", origin: "http://evil.example" , raw: true });
const res2 = await poison.fetch("/nalog/lozinka", { method: "POST", headers: { "next-action": (await import("./h.mjs")).ACTIONS["actions:requestResetAction"], origin: "http://evil.example", host: "evil.example", "x-forwarded-host": "evil.example", "content-type": "text/plain;charset=UTF-8" }, body: JSON.stringify(["mira@example.test"]) });
await res2.text(); await wait(800);
mail = mails().slice(m2).find((m) => m.to.some((t) => t.includes("mira@")));
const poisoned = mail ? decode(mail.data).match(/https?:\/\/[^\s"<]+\/nalog\/lozinka\/[\w-]+/)?.[0] : null;
check("sec", "link za lozinku kupca ne prati podmetnut Host/X-Forwarded-Host", !poisoned || !poisoned.includes("evil.example"), `status ${res2.status}; link u emailu: ${poisoned ?? "poruka nije poslata"}`);

section("Brisanje naloga");
const temp = new Session();
await temp.act("registerAction", [{ firstName: "Za", lastName: "Brisanje", email: "brisanje@example.test", password: "Lozinka-za-brisanje", news: false }], { path: "/nalog" });
await temp.act("placeOrderAction", [{ customer: { ...customer, email: "brisanje@example.test", phone: "064 999 8888" }, items: [{ slug: "lampa-akcija", qty: 1 }], promoCode: "", payment: "cod", delivery: "kurir" }], { path: "/placanje" });
r = await temp.act("deleteAccountAction", [], { path: "/nalog" });
const gone = (await q("SELECT COUNT(*) c FROM shop_users WHERE email='brisanje@example.test'"))[0].c;
const kept = (await q("SELECT COUNT(*) c FROM orders WHERE email='brisanje@example.test'"))[0].c;
check("pos", "kupac briše nalog; porudžbina ostaje prodavcu", gone === 0 && kept === 1, `nalog: ${gone}, porudžbina: ${kept}`);
r = await anon.act("deleteAccountAction", [], { path: "/nalog" });
check("sec", "brisanje naloga bez prijave ne radi ništa", (await q("SELECT COUNT(*) c FROM shop_users"))[0].c >= 1, `status ${r.status}`);

section("Google prijava (bez izlaska na internet)");
r = await anon.get("/api/auth/google");
check("pos", "dok Google nije podešen, /api/auth/google vraća na /nalog (ne zove Google)", [302, 307].includes(r.status) && /\/nalog$/.test(r.location ?? ""), `status ${r.status} → ${r.location}`);
r = await anon.get("/api/auth/google/callback?code=x&state=y");
check("sec", "povratak sa „Google-a“ bez podešavanja ne prijavljuje nikoga", /greska=google/.test(r.location ?? "") && !anon.cookies.has("demoshop-session"), `status ${r.status} → ${r.location}`);

import { writeFileSync } from "node:fs";
writeFileSync(new URL("../state.json", import.meta.url), JSON.stringify({ ...state, mine }));
await done();
