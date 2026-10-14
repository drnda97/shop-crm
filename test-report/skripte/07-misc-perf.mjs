import { readFileSync, existsSync } from "node:fs";
import { Session, check, section, done, q, short, note, ACTIONS, db } from "./h.mjs";
const state = JSON.parse(readFileSync(new URL("../state.json", import.meta.url)));
const mailFile = new URL("../mails.jsonl", import.meta.url);
const mails = () => (existsSync(mailFile) ? readFileSync(mailFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const decode = (data) => data.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errOf = (r) => decodeURIComponent(r.redirect?.match(/greska=(.*)$/)?.[1] ?? r.value?.error ?? "");
const owner = new Session();
await owner.act("login", { prev: true, form: { username: "vlasnik", password: "Lozinka-12345" } }, { path: "/admin" });
const anon = new Session();
let r;
const store = { name: "Probna Radnja", currency: "RSD", currencyDecimals: "0", locale: "sr-Latn-RS", timeZone: "Europe/Belgrade", phonePrefix: "381", codePrefix: "KOD", email: "radnja@example.test", phone: "011 123 456", address: "Glavna 1, Beograd", language: "sr", languages: "en", panelLanguage: "sr", storefrontUrl: "http://127.0.0.1:3100", allowedOrigins: "" };

section("Adresa sajta nije upisana: linkovi u emailovima");
await owner.act("saveStoreAction", { form: { ...store, storefrontUrl: "" } }, { path: "/admin/podesavanja" });
await q("DELETE FROM abandoned_carts");
const f2 = await new Session().fetch("/placanje", { method: "POST", headers: { "next-action": ACTIONS["actions:saveCartAction"], origin: "https://evil.example", host: "evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https", "content-type": "text/plain;charset=UTF-8" }, body: JSON.stringify([{ email: "zrtva2@example.test", firstName: "Žrtva", items: [{ slug: "stolica-test", qty: 1 }] }]) });
await f2.text();
await q("UPDATE abandoned_carts SET updated_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 HOUR)");
let m0 = mails().length;
await owner.act("sendRemindersAction", [], { path: "/admin/korpe" });
await wait(1200);
const vm = mails().slice(m0).find((m) => m.to.some((t) => t.includes("zrtva2@")));
const vLink = vm ? decode(vm.data).match(/https?:\/\/[^\s"<]+\/korpa\/vrati\/[0-9a-f]+/)?.[0] : null;
check("sec", "podsetnik za korpu (bez upisane adrese sajta) ne vodi na adresu koju je podmetnuo posetilac", !vLink || !vLink.includes("evil.example"), `link u emailu poslatom na tuđu adresu: ${vLink ?? "nije poslat"}`);
await owner.act("saveStoreAction", { form: store }, { path: "/admin/podesavanja" });

section("Ograničenje pokušaja: šta je „adresa posetioca“");
const kind = async (ip) => { const s = new Session(ip); if (ip === null) s.ip = ""; let n = 0; for (let i = 0; i < 24; i++) { const t = await s.act("trackOrderAction", [{ number: "1", email: "a@b.rs" }], { path: "/pracenje" }); if (/Previše/.test(t.value?.error ?? "")) break; n++; } return n; };
const direct = await kind(null);
const sameAsLocal = await Promise.all(["127.0.0.1", "::1", "::ffff:127.0.0.1"].map(async (ip) => [ip, await new Session(ip).act("trackOrderAction", [{ number: "1", email: "a@b.rs" }], { path: "/pracenje" })]));
note(`bez zaglavlja X-Forwarded-For: prošlo ${direct} pokušaja pre blokade; posle toga blokirane su i adrese: ${sameAsLocal.filter(([, t]) => /Previše/.test(t.value?.error ?? "")).map(([ip]) => ip).join(", ") || "nijedna od probanih"}`);

section("Pregled nesačuvanih izmena (?pregled=)");
r = await owner.act("createPageAction", { form: { title: "Tajna Stranica" } }, { path: "/admin/stranice/nova" });
r = await anon.get("/tajna-stranica");
check("sec", "nacrt stranice bez žetona → 404", r.status === 404, `status ${r.status}`);
for (const token of ["1", "9999999999999.abc", `${Date.now() + 1e6}.${"0".repeat(64)}`, "../../x", "9".repeat(400)]) {
  r = await anon.get(`/tajna-stranica?pregled=${encodeURIComponent(token)}`);
  check("sec", `nacrt sa lažnim žetonom „${token.slice(0, 18)}“ → 404`, r.status === 404, `status ${r.status}`);
}
r = await anon.get("/tajna-stranica", { headers: { "x-shop-preview": "1", "x-preview": "1", "x-shopcrm-preview": "1" } });
check("sec", "zaglavlje za pregled koje pošalje posetilac se odbacuje", r.status === 404, `status ${r.status}`);
const editor = await owner.get("/admin/stranice/tajna-stranica");
const tok = editor.text.match(/pregled=(\d+\.[0-9a-f]{64})/)?.[1];
r = tok ? await anon.get(`/tajna-stranica?pregled=${tok}`) : { status: "nema žetona" };
check("pos", "nacrt sa ispravnim žetonom iz uređivača se vidi", r.status === 200, `status ${r.status}`);

section("Jezici");
r = await anon.api("/products/stolica-test?lang=en");
check("pos", "API ?lang=en vraća Content-Language: en", r.headers.get("content-language") === "en", r.headers.get("content-language"));
r = await new Session().api("/orders?lang=en", { method: "POST", body: {} });
check("pos", "poruke o grešci na engleskom uz ?lang=en", /name|Enter|Please/i.test(JSON.stringify(r.json?.errors ?? {})) && !/Upišite/.test(JSON.stringify(r.json)), short(r.json, 160));
r = await anon.api("/products?lang=%3Cscript%3E");
check("neg", "nepoznat jezik u ?lang= se ignoriše", r.status === 200 && r.headers.get("content-language") === "sr", `${r.status} ${r.headers.get("content-language")}`);
for (const path of ["/xx", "/de/kolekcija", "/zz/proizvod/stolica-test"]) {
  r = await anon.get(path);
  check("neg", `adresa sa jezikom koji prodavnica nema (${path}) → 404`, r.status === 404, `status ${r.status} — otvara istu stranicu kao bez prefiksa (duple adrese za pretraživače)`);
}

section("Kolekcija: filteri i neispravni parametri");
for (const query of ["?sortiraj=%27%3BDROP%20TABLE%20products", "?sortiraj=__proto__", "?strana=-5", "?strana=999999999999999999999", "?strana=abc", "?cena-od=abc&cena-do=-1", "?cena-od=1e400", "?pretraga=%25%27%22%5C", "?pretraga=" + "a".repeat(3000), "?boja=%00", "?sortiraj=cena-rast&cena-od=0&cena-do=99999999999"]) {
  r = await anon.get(`/kolekcija${query}`);
  check("neg", `/kolekcija${query.slice(0, 44)} ne ruši stranicu`, r.status === 200 && !/Application error/.test(r.text), `status ${r.status}`);
}
check("sec", "posle svega tabela products postoji i ima redove", (await q("SELECT COUNT(*) c FROM products"))[0].c > 5);

section("Isključen pristup spolja");
await owner.act("saveAccessAction", { form: {} }, { path: "/admin/integracije" });
r = await anon.api("/products");
const r2 = await new Session().api("/orders", { method: "POST", body: {} });
const r3 = await anon.api("/cart", { method: "POST", body: { items: [] } });
check("sec", "javni API isključen → 403 za čitanje, korpu i porudžbine", r.status === 403 && r2.status === 403 && r3.status === 403, `${r.status} ${r2.status} ${r3.status}`);
r = await anon.get("/proizvod/stolica-test");
const q1 = await anon.act("quoteAction", [{ items: [{ slug: "stolica-test", qty: 1 }], promoCode: "", delivery: "kurir", zip: "11000" }], { path: "/placanje" });
check("pos", "prodavnica radi i kada je API isključen", r.status === 200 && q1.value?.total > 0, `status ${r.status}, obračun ${short(q1.value)}`);
r = await anon.get("/demo.html");
note(`/demo.html i /sdk.js ostaju dostupni i kada je API isključen (status ${r.status}); demo tada ne može da učita proizvode`);
await owner.act("saveAccessAction", { form: { publicApi: "on", adminApi: "on", webhooks: "on" } }, { path: "/admin/integracije" });

section("Šablon emaila i podešavanja");
const tpl = (text) => new File([text], "sablon.html", { type: "text/html" });
r = await owner.act("uploadTemplateAction", { form: { template: tpl("samo tekst bez oznaka") } }, { path: "/admin/podesavanja" });
check("neg", "fajl koji nije šablon se odbija", /ne liči/.test(errOf(r)), errOf(r));
r = await owner.act("uploadTemplateAction", { form: { template: tpl(`<html><body><script>alert(1)</script><h1>{{prodavnica}}</h1>{{stavke}} {{ukupno}} {{nepostojece}} {{constructor}}</body></html>`) } }, { path: "/admin/podesavanja" });
check("pos", "sopstveni šablon emaila se prima", /ok=/.test(r.redirect ?? ""), r.redirect);
r = await owner.get("/admin/podesavanja/pregled");
check("sec", "pregled šablona se prikazuje u izolaciji (CSP sandbox)", r.status === 200 && /sandbox/.test(r.headers.get("content-security-policy") ?? ""), `status ${r.status}; CSP ${r.headers.get("content-security-policy")}`);
r = await owner.get("/admin/podesavanja/sablon");
check("pos", "preuzimanje šablona", r.status === 200, `status ${r.status}`);
await owner.act("resetTemplateAction", [], { path: "/admin/podesavanja" });
r = await owner.get("/admin/podesavanja");
check("sec", "stranica podešavanja ne ispisuje SMTP lozinku ni tajnu servera", !/app_secret|smtpPassword":"[^"]+/.test(r.text), "");
r = await owner.act("saveAnalyticsAction", { form: { ga4: `G-X"><script>alert(1)</script>`, metaPixel: "" } }, { path: "/admin/podesavanja" });
check("sec", "GA4 oznaka sa HTML-om se odbija", /GA4/.test(errOf(r)), errOf(r));
r = await owner.act("saveAuthAction", { form: { googleClientId: "evil.example", googleClientSecret: "x" } }, { path: "/admin/podesavanja" });
check("neg", "neispravan Google Client ID se odbija", /Google/.test(errOf(r)), errOf(r));
r = await owner.act("saveSettingsPartAction", [{ part: "theme", value: { colors: { accent: `red;}</style><script>alert(1)</script>`, background: "#ffffff", text: "#000000", surface: "#eeeeee" }, fonts: { display: "x", body: "y" } } }], { path: "/admin/izgled" });
const css = await anon.get("/api/theme/default.css");
const home = await anon.get("/");
check("sec", "boja teme ne može da ubaci </style><script> u stranicu", !/<\/style><script>alert\(1\)/.test(home.text) && !/<script>alert/.test(css.text), `akcija: ${short(r.value ?? r.redirect ?? r.status)}`);

section("Rad sa više podataka (3.000 porudžbina, 1.500 proizvoda)");
const t = async (label, fn, limitMs) => { const t0 = Date.now(); const res = await fn(); const ms = Date.now() - t0; check("pos", `${label} — ispod ${limitMs} ms`, ms < limitMs && (res?.status ?? 200) < 500, `${ms} ms`); return ms; };
const base = { home: 0 };
const time = async (fn) => { const t0 = Date.now(); await fn(); return Date.now() - t0; };
const small = { home: await time(() => anon.get("/")), coll: await time(() => anon.get("/kolekcija")), orders: await time(() => owner.get("/admin/porudzbine")), dash: await time(() => owner.get("/admin")), api: await time(() => anon.api("/products")), prodList: await time(() => owner.get("/admin/proizvodi")) };
note(`pre punjenja (≈${(await q("SELECT COUNT(*) c FROM orders"))[0].c} porudžbina, ${(await q("SELECT COUNT(*) c FROM products"))[0].c} proizvoda): početna ${small.home} ms, kolekcija ${small.coll} ms, panel porudžbine ${small.orders} ms, pregled ${small.dash} ms, panel proizvodi ${small.prodList} ms, API proizvodi ${small.api} ms`);
// Punjenje direktno u probnu bazu
const now = Date.now();
for (let batch = 0; batch < 6; batch++) {
  const rows = Array.from({ length: 500 }, (_, i) => { const k = batch * 500 + i; return [new Date(now - k * 3600_000), ["new", "confirmed", "shipped", "delivered", "cancelled"][k % 5], `t6${String(1000000 + k)}`, `Kupac Broj ${k}`, `06${String(1000000 + k)}`, `kupac${k}@example.test`, `Ulica ${k}`, "Beograd", "11000", "", "cod", 10000, 500, 10500]; });
  const [res] = await db.query("INSERT INTO orders (received_at, status, customer_key, customer_name, phone, email, street, city, postal_code, note, payment_method, subtotal, delivery, total) VALUES ?", [rows]);
  await db.query("INSERT INTO order_items (order_number, position, slug, name, sku, qty, price) VALUES ?", [Array.from({ length: 500 }, (_, i) => [res.insertId + i, 0, "stolica-test", "Stolica Test", "ST-1", 1, 10000])]);
}
const maxPos = (await q("SELECT MAX(position) p FROM products"))[0].p;
await db.query("INSERT INTO products (slug, position, name, sku, category, active, summary, description, attributes, price, in_stock) VALUES ?", [Array.from({ length: 1500 }, (_, i) => [`masovni-${i}`, maxPos + 1 + i, `Masovni proizvod ${i}`, `M-${i}`, "fotelje", 1, "Opis", "Dug opis proizvoda ".repeat(20), "[]", 1000 + i, 1])]);
// Jedna izmena iz panela osvežava spisak za prodavnicu
const saveMs = await time(() => owner.act("saveProductAction", { form: { name: "Posle Punjenja", price: "100", status: "active" } }, { path: "/admin/proizvodi/novi" }));
const big = { home: await time(() => anon.get("/")), coll: await time(() => anon.get("/kolekcija")), orders: await time(() => owner.get("/admin/porudzbine")), dash: await time(() => owner.get("/admin")), api: await time(() => anon.api("/products")), prodList: await time(() => owner.get("/admin/proizvodi")) };
const sizeOrders = (await owner.get("/admin/porudzbine")).text.length;
const sizeProducts = (await owner.get("/admin/proizvodi")).text.length;
const sizeApi = (await anon.api("/products")).text.length;
note(`posle punjenja: početna ${big.home} ms, kolekcija ${big.coll} ms, panel porudžbine ${big.orders} ms (${Math.round(sizeOrders / 1024)} KB), pregled ${big.dash} ms, panel proizvodi ${big.prodList} ms (${Math.round(sizeProducts / 1024)} KB), API proizvodi ${big.api} ms (${Math.round(sizeApi / 1024)} KB), čuvanje jednog proizvoda ${saveMs} ms`);
check("pos", "početna strana prodavnice ispod 1 s sa 1.500 proizvoda", big.home < 1000, `${big.home} ms`);
check("pos", "stranica kolekcije ispod 1 s sa 1.500 proizvoda", big.coll < 1000, `${big.coll} ms`);
check("pos", "spisak porudžbina u panelu ispod 2 s sa 3.000 porudžbina", big.orders < 2000, `${big.orders} ms, ${Math.round(sizeOrders / 1024)} KB HTML-a`);
check("pos", "spisak proizvoda u panelu ispod 2 s sa 1.500 proizvoda", big.prodList < 2000, `${big.prodList} ms, ${Math.round(sizeProducts / 1024)} KB HTML-a`);
check("pos", "čuvanje jednog proizvoda ispod 2 s sa 1.500 proizvoda", saveMs < 2000, `${saveMs} ms (ceo katalog se briše i upisuje ponovo)`);
check("pos", "API /products ima straničenje (ne vraća svih 1.500 odjednom)", sizeApi < 400 * 1024, `${Math.round(sizeApi / 1024)} KB u jednom odgovoru, bez ?page/?limit`);
const ordMs = await time(async () => { r = await new Session().api("/orders", { method: "POST", body: { customer: { name: "Posle Punjenja", phone: "069 123 0000", email: "posle@example.test", street: "Ulica 1", city: "Beograd", postalCode: "11000", note: "" }, items: [{ slug: "stolica-test", qty: 1 }] } }); });
check("pos", "porudžbina preko API-ja ispod 1 s", ordMs < 1000 && r.status === 201, `${ordMs} ms, status ${r.status}`);
const actMs = await time(async () => { r = await new Session().act("placeOrderAction", [{ customer: { email: "posle2@example.test", phone: "069 123 0001", firstName: "Posle", lastName: "Punjenja", address: "Ulica 1", city: "Beograd", zip: "11000", note: "" }, items: [{ slug: "stolica-test", qty: 1 }], promoCode: "", payment: "cod", delivery: "kurir" }], { path: "/placanje" }); });
check("pos", "porudžbina sa sajta ispod 1 s", actMs < 1000 && r.value?.ok, `${actMs} ms (posle upisa čita SVE porudžbine da nađe jednu)`);
// 200 zahteva odjednom
const t0 = Date.now();
const burst = await Promise.all(Array.from({ length: 200 }, (_, i) => new Session().get(i % 2 ? "/proizvod/stolica-test" : "/kolekcija")));
const burstMs = Date.now() - t0;
check("pos", "200 istovremenih posetilaca: svi dobijaju stranicu", burst.every((x) => x.status === 200), `${burstMs} ms ukupno; statusi ${[...new Set(burst.map((x) => x.status))].join()}`);
const t1 = Date.now();
const apiBurst = await Promise.all(Array.from({ length: 100 }, () => new Session().api("/cart", { method: "POST", body: { items: [{ slug: "stolica-test", qty: 1 }], discountCode: "DOSTAVA" } })));
check("pos", "100 istovremenih obračuna korpe preko API-ja", apiBurst.every((x) => x.status === 200), `${Date.now() - t1} ms; statusi ${[...new Set(apiBurst.map((x) => x.status))].join()}`);

section("Baza: celovitost posle svih testova");
const orphanItems = (await q("SELECT COUNT(*) c FROM order_items i LEFT JOIN orders o ON o.number=i.order_number WHERE o.number IS NULL"))[0].c;
check("pos", "nema stavki bez porudžbine", orphanItems === 0, `${orphanItems}`);
const noItems = (await q("SELECT COUNT(*) c FROM orders o LEFT JOIN order_items i ON i.order_number=o.number WHERE i.id IS NULL"))[0].c;
check("pos", "nema porudžbina bez stavki", noItems === 0, `${noItems}`);
const negative = (await q("SELECT (SELECT COUNT(*) FROM products WHERE stock_qty < 0) + (SELECT COUNT(*) FROM product_variants WHERE stock_qty < 0) c"))[0].c;
check("pos", "nema negativnog stanja", Number(negative) === 0, `${negative}`);
const badTotals = (await q("SELECT COUNT(*) c FROM orders WHERE total <> subtotal - discount_amount + delivery OR total < 0 OR refunded > total"))[0].c;
check("pos", "svaka porudžbina: ukupno = međuzbir − popust + dostava, povraćaj ≤ ukupno", badTotals === 0, `neispravnih: ${badTotals}`);
const sums = (await q("SELECT COUNT(*) c FROM orders o JOIN (SELECT order_number, SUM(qty*price) s FROM order_items GROUP BY order_number) i ON i.order_number=o.number WHERE i.s <> o.subtotal"))[0].c;
check("pos", "međuzbir svake porudžbine = zbir stavki", sums === 0, `neispravnih: ${sums}`);
const dupCodes = (await q("SELECT COUNT(*) c FROM (SELECT used_order FROM discount_codes WHERE used_order IS NOT NULL GROUP BY id HAVING COUNT(*)>1) x"))[0].c;
const logged = (await q("SELECT COUNT(*) c FROM stock_log"))[0].c;
check("pos", "istorija stanja se vodi", logged > 20, `zapisa: ${logged}`);
const fk = (await q("SELECT COUNT(*) c FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='shopcrm_test'"))[0].c;
note(`stranih ključeva u bazi: ${fk} (veze između tabela čuva samo kod)`);
const tables = await q("SELECT TABLE_NAME n, TABLE_COLLATION c, ENGINE e FROM information_schema.TABLES WHERE TABLE_SCHEMA='shopcrm_test'");
check("pos", "sve tabele su InnoDB i utf8mb4", tables.every((x) => x.e === "InnoDB" && /^utf8mb4/.test(x.c)), `${tables.length} tabela; izuzeci: ${tables.filter((x) => x.e !== "InnoDB" || !/^utf8mb4/.test(x.c)).map((x) => x.n).join() || "nema"}`);
const plain = (await q("SELECT value FROM settings WHERE name='settings'"))[0].value;
note(`SMTP lozinka i Google tajna se u bazi čuvaju kao običan tekst u redu „settings“ (${/smtpPassword/.test(plain) ? "polje smtpPassword postoji" : "nema polja"}); API ključevi i lozinke su heširani`);
const resets = await q("SELECT token_hash FROM admin_password_resets LIMIT 1");
check("sec", "žetoni za novu lozinku su u bazi kao heš", resets.length === 0 || /^[0-9a-f]{64}$/.test(resets[0].token_hash), "");
const hookSecret = (await q("SELECT secret FROM webhooks LIMIT 1"))[0]?.secret;
note(`tajna webhook-a je u bazi kao običan tekst (${hookSecret ? "da" : "nema webhook-a"}) — mora, jer se njome potpisuje`);

await done();
process.exit(0);
