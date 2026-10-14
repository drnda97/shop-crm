import { readFileSync } from "node:fs";
import { Session, check, section, done, q, short, note, BASE } from "./h.mjs";
const keys = JSON.parse(readFileSync(new URL("../keys.json", import.meta.url)));
const s = new Session();
const cust = (over = {}) => ({ name: "Petar Petrović", phone: "064 123 4567", email: "petar@example.test", street: "Glavna 1", city: "Beograd", postalCode: "11000", note: "", ...over });
let uniq = 0;
/** Svaka porudžbina sa svoje adrese, da brojač (10 na 10 min) ne smeta drugim proverama. */
const order = (body, session = new Session()) => session.api("/orders", { method: "POST", body });
const stock = async (slug) => (await q("SELECT stock_qty FROM products WHERE slug=?", [slug]))[0]?.stock_qty;

section("Javni API: čitanje");
let r = await s.api("/store");
check("pos", "GET /store", r.status === 200 && r.json?.name === "Probna Radnja", short(r.json, 200));
const storeText = JSON.stringify(r.json);
check("sec", "/store ne otkriva SMTP, tajne ni interne podatke", !/smtp|password|secret|sellerEmail|127\.0\.0\.1:2525/i.test(storeText), storeText.match(/smtp|password|secret|sellerEmail/gi)?.join() ?? "");
r = await s.api("/site");
check("sec", "/site ne otkriva SMTP ni tajne", r.status === 200 && !/smtp|password|secret/i.test(r.text), r.text.match(/smtp|password|secret/gi)?.join() ?? "");
r = await s.api("/products");
const slugs = r.json?.products?.map((p) => p.slug) ?? [];
check("pos", "GET /products vraća objavljene", r.status === 200 && slugs.includes("stolica-test"), slugs.join());
check("sec", "nacrti nisu u /products", !slugs.includes("nacrt-proizvod") && !slugs.includes("stolica-test-2"), slugs.join());
r = await s.api("/products/nacrt-proizvod");
check("sec", "nacrt po oznaci → 404", r.status === 404, `status ${r.status}`);
r = await s.api("/products/stolica-test");
check("pos", "GET /products/{slug}", r.status === 200 && r.json?.product?.currentPrice === 10000, short(r.json, 200));
check("sec", "javni proizvod ne otkriva tačan broj komada preko polja stockQty", r.json?.product?.stockQty === undefined, `stockQty=${r.json?.product?.stockQty}, maxQty=${r.json?.product?.maxQty}`);
r = await s.api("/products/fotelja-varijante");
const variants = r.json?.product?.variants ?? [];
check("pos", "proizvod sa varijantama: 4 varijante, isključena i rasprodata nisu dostupne", variants.length >= 3 && variants.find((v) => v.id === "plava-orah")?.available === false, short(variants.map((v) => `${v.id}:${v.available}:${v.currentPrice}`), 300));
r = await s.api("/products?category=stolice");
check("pos", "filter po kategoriji obuhvata podkategoriju", r.json?.products?.some((p) => p.slug === "deset-komada") && r.json?.products?.some((p) => p.slug === "stolica-test"), r.json?.products?.map((p) => p.slug).join());
r = await s.api("/products?q=lampa");
check("pos", "pretraga ?q=", r.json?.products?.length === 1, r.json?.products?.map((p) => p.slug).join());
for (const path of ["/categories", "/collections", "/pages", "/blog", "/sections"]) {
  r = await s.api(path);
  check("pos", `GET ${path}`, r.status === 200 && r.json, `status ${r.status}`);
}
r = await s.api("/pages");
const pages = r.json?.pages ?? [];
note(`stranice: ${pages.map((p) => p.slug).join(", ")}`);

section("Javni API: neispravni i zlonamerni zahtevi");
for (const [path, want] of [
  ["/products/' OR '1'='1", 404], ["/products/../../admin", 404], ["/products/%00", 404], ["/nepostoji", 404], ["/products/a/b/c", 404],
  ["/products?q=' UNION SELECT * FROM admin_users -- ", 200], ["/products?category=%27%3B DROP TABLE products%3B--", 200], ["/collections/' OR 1=1", 404], ["/pages/<script>", 404],
  ["/blog/' OR 1=1 --", 404], ["/products?q=" + "a".repeat(20000), 200],
]) {
  r = await s.api(path);
  check("sec", `GET ${path.slice(0, 60)} → ${want}`, r.status === want && r.json !== null, `status ${r.status} ${short(r.text, 100)}`);
}
check("sec", "posle SQL pokušaja tabela products je cela", (await q("SELECT COUNT(*) c FROM products"))[0].c >= 12);
for (const method of ["PUT", "DELETE", "PATCH"]) {
  const res = await s.fetch("/api/v1/products/stolica-test", { method });
  check("sec", `${method} /products/{slug} nije dozvoljen`, res.status === 405, `status ${res.status}`);
}
r = await s.api("/orders");
check("sec", "GET /orders (spisak porudžbina) ne postoji javno", r.status === 404, `status ${r.status} ${short(r.text, 80)}`);
r = await s.api("/admin/orders");
check("sec", "/admin/orders bez ključa → 401", r.status === 401, `status ${r.status}`);
r = await s.api("/cart", { method: "POST", body: "{nije json" });
check("neg", "POST /cart sa pokvarenim JSON-om ne ruši server", r.status === 200 && r.json?.lines?.length === 0, `status ${r.status} ${short(r.text, 120)}`);
r = await s.api("/cart", { method: "POST", body: "null" });
check("neg", "POST /cart sa telom null", r.status === 200, `status ${r.status} ${short(r.text, 120)}`);
r = await s.api("/cart", { method: "POST", body: "[1,2,3]" });
check("neg", "POST /cart sa nizom umesto objekta", r.status === 200, `status ${r.status}`);
r = await s.api("/orders", { method: "POST", body: '"tekst"' });
check("neg", "POST /orders sa tekstom umesto objekta → 422", r.status === 422, `status ${r.status} ${short(r.text, 120)}`);
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: { $ne: 1 }, qty: 1 }, { slug: "stolica-test", qty: "2" }, { slug: "stolica-test", qty: -5 }, { slug: "stolica-test", qty: 1.5 }, { slug: "stolica-test", qty: 1e308 }, null, 7, { slug: ["a"], qty: 1 }], discountCode: { a: 1 }, deliveryMethod: ["x"], postalCode: 11000 } });
check("neg", "korpa sa pogrešnim tipovima polja se preskače bez greške", r.status === 200 && r.json?.lines?.length === 0, `status ${r.status} ${short(r.text, 160)}`);
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "__proto__", qty: 1 }, { slug: "constructor", qty: 1 }], __proto__: { publicApi: true } } });
check("sec", "korpa sa __proto__ / constructor oznakama", r.status === 200 && r.json?.lines?.length === 0, `status ${r.status}`);
const huge = JSON.stringify({ items: Array.from({ length: 50000 }, (_, i) => ({ slug: `x${i}`, qty: 1 })) });
let t0 = Date.now();
r = await s.api("/cart", { method: "POST", body: huge });
check("sec", "korpa sa 50.000 stavki (1,2 MB) ne obara server", r.status < 500 && Date.now() - t0 < 5000, `status ${r.status}, ${Date.now() - t0} ms`);
t0 = Date.now();
const res20 = await s.fetch("/api/v1/cart", { method: "POST", headers: { "content-type": "application/json" }, body: '{"items":[],"x":"' + "A".repeat(20 * 1024 * 1024) + '"}' }).catch((e) => ({ status: `greška ${e.cause?.code ?? e.message}` }));
check("sec", "telo zahteva od 20 MB se odbija (ograničenje veličine)", res20.status === 413, `status ${res20.status}, ${Date.now() - t0} ms — API prima telo bilo koje veličine`);

section("Javni API: korpa i obračun");
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "stolica-test", qty: 2 }, { slug: "lampa-akcija", qty: 1 }], postalCode: "21000" } });
check("pos", "obračun: 2×10000 + akcija 4000 = 24000, dostava besplatna preko 20000", r.json?.pricing?.subtotal === 24000 && r.json?.pricing?.delivery === 0 && r.json?.pricing?.total === 24000, short(r.json?.pricing));
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "lampa-akcija", qty: 1 }], postalCode: "21000" } });
check("pos", "obračun: 4000 + dostava 500", r.json?.pricing?.total === 4500, short(r.json?.pricing));
check("pos", "za 21000 se ne nudi dostava samo za Beograd (zona 11)", !r.json?.deliveryMethods?.some((m) => m.id === "bg-brza"), r.json?.deliveryMethods?.map((m) => m.id).join());
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "stolica-test", qty: 2 }], postalCode: "11000", deliveryMethod: "bg-brza" } });
check("pos", "dostava po težini: 8 kg → 1500", r.json?.pricing?.delivery === 1500, short(r.json?.pricing));
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "stolica-test", qty: 99 }] } });
check("neg", "količina veća od stanja se svodi na stanje (5)", r.json?.lines?.[0]?.qty === 5, `qty ${r.json?.lines?.[0]?.qty}`);
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "nacrt-proizvod", qty: 1 }, { slug: "nema-na-stanju", qty: 1 }, { slug: "bez-cene", qty: 1 }, { slug: "nepostoji", qty: 1 }, { slug: "fotelja-varijante", qty: 1 }, { slug: "fotelja-varijante", qty: 1, variant: "plava-hrast" }, { slug: "fotelja-varijante", qty: 1, variant: "plava-orah" }] } });
check("neg", "nacrt, rasprodat, bez cene, nepostojeći, bez varijante, isključena i rasprodata varijanta ispadaju iz korpe", r.json?.lines?.length === 0 && r.json?.removed?.length >= 5, `lines ${r.json?.lines?.map((l) => l.product.slug + "/" + (l.variant?.id ?? "")).join()} removed ${r.json?.removed?.join()}`);
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "fotelja-varijante", qty: 1, variant: "crvena-orah" }] } });
check("pos", "varijanta sa svojom akcijskom cenom 33000", r.json?.pricing?.subtotal === 33000, short(r.json?.pricing));
for (const [code, want, title] of [
  ["leto10", 2400, "kod malim slovima LETO10 → 10%"], ["MINUS2000", 2000, "fiksni iznos 2000 uz korpu preko 15000"], ["STO", 24000, "kod 100% → popust ceo iznos proizvoda"],
]) {
  r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "stolica-test", qty: 2 }, { slug: "lampa-akcija", qty: 1 }], discountCode: code } });
  check("pos", title, r.json?.pricing?.discount === want && r.json?.pricing?.total >= 0, short({ p: r.json?.pricing, e: r.json?.discountError }));
}
for (const code of ["ISTEKAO", "NACRT", "NEPOSTOJI", "' OR 1=1 --", "A".repeat(500)]) {
  r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "stolica-test", qty: 1 }], discountCode: code } });
  check("neg", `kod „${code.slice(0, 20)}" ne daje popust`, r.json?.pricing?.discount === 0 && !!r.json?.discountError, short({ p: r.json?.pricing, e: r.json?.discountError }));
}
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "lampa-akcija", qty: 1 }], discountCode: "MINUS2000" } });
check("neg", "kod sa najmanjom korpom 15000 ne važi za korpu od 4000", r.json?.pricing?.discount === 0 && /ne važi/.test(r.json?.discountError ?? ""), short({ p: r.json?.pricing, e: r.json?.discountError }));
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "lampa-akcija", qty: 1 }], discountCode: "FOTELJE20" } });
check("neg", "kod za kategoriju fotelje ne važi za lampu", r.json?.pricing?.discount === 0, short({ p: r.json?.pricing, e: r.json?.discountError }));
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "lampa-akcija", qty: 1 }, { slug: "fotelja-varijante", qty: 1, variant: "crvena-hrast" }], discountCode: "FOTELJE20" } });
check("pos", "kod za kategoriju: 20% samo na fotelju (6000)", r.json?.pricing?.discount === 6000, short(r.json?.pricing));
r = await s.api("/cart", { method: "POST", body: { items: [{ slug: "lampa-akcija", qty: 1 }], discountCode: "DOSTAVA", postalCode: "21000" } });
check("pos", "kod za besplatnu dostavu", r.json?.pricing?.delivery === 0 && r.json?.pricing?.total === 4000, short(r.json?.pricing));
r = await s.api("/discounts/check", { method: "POST", body: { code: "LETO10" } });
check("pos", "POST /discounts/check važeći kod", r.json?.ok === true, short(r.json));
r = await s.api("/discounts/check", { method: "POST", body: { code: 12345 } });
check("neg", "/discounts/check sa brojem umesto teksta", r.json?.ok === false, short(r.json));

section("Javni API: porudžbina — pozitivni tok");
const stockBefore = await stock("stolica-test");
r = await order({ customer: cust(), items: [{ slug: "stolica-test", qty: 1 }, { slug: "lampa-akcija", qty: 2 }], paymentMethod: "cod", deliveryMethod: "kurir" });
const first = r.json?.orderNumber;
check("pos", "porudžbina pouzećem → 201", r.status === 201 && r.json?.ok && r.json?.total === 18500, short(r.json, 300));
check("pos", "stanje se skida (5 → 4)", (await stock("stolica-test")) === stockBefore - 1, `${stockBefore} → ${await stock("stolica-test")}`);
const row = (await q("SELECT * FROM orders WHERE number=?", [first]))[0];
check("pos", "porudžbina u bazi: iznosi, status nova, PDV 20%", row?.total === 18500 && row?.status === "new" && Number(row?.tax_percent) === 20 && row?.delivery === 500, short({ total: row?.total, status: row?.status, tax: row?.tax_percent, delivery: row?.delivery }));
check("pos", "prvi kupac dobija kod nagrade (15%)", !!row?.issued_code && row?.issued_percent === 15, `${row?.issued_code} ${row?.issued_percent}%`);
r = await order({ customer: cust({ email: "ana@example.test", phone: "065 111 222" }), items: [{ slug: "lampa-akcija", qty: 1 }], paymentMethod: "bank" });
check("pos", "porudžbina uplatom na račun vraća podatke za uplatu", r.status === 201 && /160-000000-00/.test(r.json?.paymentInstructions ?? ""), short(r.json, 200));
r = await order({ customer: cust({ email: "kartica@example.test", phone: "065 333 444" }), items: [{ slug: "lampa-akcija", qty: 1 }], paymentMethod: "card" });
const cardOrder = r.json?.orderNumber;
const payUrl = r.json?.paymentUrl;
check("pos", "porudžbina karticom vraća paymentUrl", r.status === 201 && /proba-kartice/.test(payUrl ?? ""), short(r.json, 300));
r = await order({ customer: cust({ email: "preuzimanje@example.test", phone: "065 555 666" }), items: [{ slug: "lampa-akcija", qty: 1 }], deliveryMethod: "pickup" });
check("pos", "lično preuzimanje: dostava 0", r.status === 201 && r.json?.total === 4000, short(r.json, 200));
r = await order({ customer: cust({ email: "var@example.test", phone: "065 777 888" }), items: [{ slug: "fotelja-varijante", qty: 1, variant: "crvena-orah" }], discountCode: "leto10" });
check("pos", "porudžbina varijante sa kodom LETO10: 33000 − 3300, dostava besplatna", r.status === 201 && r.json?.total === 29700, short(r.json, 200));
check("pos", "stanje varijante se skida (1 → 0)", (await q("SELECT stock_qty FROM product_variants WHERE id='crvena-orah'"))[0].stock_qty === 0);
r = await order({ customer: cust({ email: "var2@example.test", phone: "065 777 889" }), items: [{ slug: "fotelja-varijante", qty: 1, variant: "crvena-orah" }] });
check("neg", "rasprodata varijanta ne može da se poruči", r.status === 422 && /nije na stanju/.test(r.json?.message ?? ""), short(r.json));
r = await order({ customer: cust({ email: "free@example.test", phone: "065 000 111" }), items: [{ slug: "besplatan-uzorak", qty: 99 }], deliveryMethod: "pickup" });
note(`besplatan proizvod ×99 uz lično preuzimanje: status ${r.status}, ukupno ${r.json?.total} (porudžbina od 0 din prolazi)`);

section("Javni API: porudžbina — negativni tok");
const bad = async (title, body, test, kind = "neg") => {
  const res = await order(body);
  check(kind, title, res.status === 422 && test(res.json), `status ${res.status} ${short(res.json, 250)}`);
};
const items = [{ slug: "lampa-akcija", qty: 1 }];
await bad("prazna porudžbina", {}, (j) => Object.keys(j.errors).length >= 6);
await bad("bez imena", { customer: cust({ name: "" }), items }, (j) => !!j.errors.name);
await bad("telefon sa slovima", { customer: cust({ phone: "abc" }), items }, (j) => !!j.errors.phone);
await bad("email bez @", { customer: cust({ email: "nije-email" }), items }, (j) => !!j.errors.email);
await bad("poštanski broj sa znakovima", { customer: cust({ postalCode: "<11>" }), items }, (j) => !!j.errors.postalCode);
await bad("napomena duža od 500", { customer: cust({ note: "x".repeat(600) }), items }, (j) => !!j.errors.note);
await bad("prazna korpa", { customer: cust(), items: [] }, (j) => /prazna/.test(j.message));
await bad("samo nepostojeći proizvod", { customer: cust(), items: [{ slug: "nepostoji", qty: 1 }] }, (j) => /prazna/.test(j.message));
await bad("nacrt proizvoda", { customer: cust(), items: [{ slug: "nacrt-proizvod", qty: 1 }] }, (j) => !!j.message, "sec");
await bad("proizvod bez cene", { customer: cust(), items: [{ slug: "bez-cene", qty: 1 }] }, (j) => !!j.message);
await bad("proizvod koji nije na stanju", { customer: cust(), items: [{ slug: "nema-na-stanju", qty: 1 }] }, (j) => /nije na stanju/.test(j.message));
await bad("više komada nego na stanju", { customer: cust(), items: [{ slug: "stolica-test", qty: 50 }] }, (j) => /još samo/.test(j.message));
await bad("proizvod sa varijantama bez izabrane varijante", { customer: cust(), items: [{ slug: "fotelja-varijante", qty: 1 }] }, (j) => /opcije/.test(j.message));
await bad("isključena varijanta", { customer: cust(), items: [{ slug: "fotelja-varijante", qty: 1, variant: "plava-hrast" }] }, (j) => !!j.message);
await bad("nepostojeći način plaćanja", { customer: cust(), items, paymentMethod: "bitcoin" }, (j) => /plaćanja/.test(j.message));
await bad("nepostojeći način dostave", { customer: cust(), items, deliveryMethod: "dron" }, (j) => /dostave/.test(j.message));
await bad("dostava van zone (Beograd za Novi Sad)", { customer: cust({ postalCode: "21000" }), items, deliveryMethod: "bg-brza" }, (j) => /dostave/.test(j.message));
await bad("istekao kod", { customer: cust(), items, discountCode: "ISTEKAO" }, (j) => /Kod za popust/.test(j.message));
await bad("kod u nacrtu", { customer: cust(), items, discountCode: "NACRT" }, (j) => /Kod za popust/.test(j.message));
await bad("tuđi kod nagrade (drugi email i telefon)", { customer: cust({ email: "lopov@example.test", phone: "069 999 0000" }), items, discountCode: row?.issued_code }, (j) => /Kod za popust/.test(j.message), "sec");

section("Javni API: pokušaji prevare pri poručivanju");
// Cena, ukupno, status poslati od strane „sajta" moraju biti ignorisani
r = await order({ customer: cust({ email: "hak1@example.test", phone: "061 000 001" }), items: [{ slug: "lampa-akcija", qty: 1, price: 1, currentPrice: 1, salePrice: 0 }], total: 1, subtotal: 1, delivery: 0, status: "delivered", paidAt: "2026-01-01", discount: { amount: 99999, percent: 100 }, number: 1, pricing: { total: 1 } });
const hacked = (await q("SELECT total, status, paid_at, discount_amount, number FROM orders WHERE number=?", [r.json?.orderNumber]))[0];
check("sec", "cena/ukupno/status/plaćeno iz zahteva se ignorišu", hacked?.total === 4500 && hacked?.status === "new" && hacked?.paid_at === null && hacked?.discount_amount === 0 && hacked?.number !== 1, short(hacked));
r = await order({ customer: cust({ email: "hak2@example.test", phone: "061 000 002" }), items: [{ slug: "lampa-akcija", qty: -3 }, { slug: "stolica-test", qty: 0 }] });
check("sec", "negativna i nulta količina ne prolaze", r.status === 422, short(r.json));
r = await order({ customer: cust({ email: "hak3@example.test", phone: "061 000 003" }), items: [{ slug: "lampa-akcija", qty: 1 }, { slug: "lampa-akcija", qty: 2147483647 }] });
check("sec", "ogromna količina se svodi na najviše 99", r.status === 201 && r.json?.total === 99 * 4000, short(r.json));
r = await order({ customer: cust({ email: "hak4@example.test", phone: "061 000 004" }), items: Array.from({ length: 200 }, () => ({ slug: "stolica-test", qty: 1 })) });
check("sec", "200 istih stavki se sabira i ne prelazi stanje", r.status === 422 && /još samo/.test(r.json?.message ?? ""), short(r.json));
// Ponovna upotreba koda za jedno korišćenje
r = await order({ customer: cust({ email: "j1@example.test", phone: "061 000 010" }), items, discountCode: "JEDNOM" });
check("pos", "kod JEDNOM prvi put prolazi (50%)", r.status === 201 && r.json?.total === 2500, short(r.json));
r = await order({ customer: cust({ email: "j2@example.test", phone: "061 000 011" }), items, discountCode: "JEDNOM" });
check("sec", "kod JEDNOM drugi put ne prolazi", r.status === 422, short(r.json));
// Kod nagrade: pravi kupac ga koristi jednom
r = await order({ customer: cust(), items, discountCode: row?.issued_code });
check("pos", "kupac koristi svoj kod nagrade (15% od 4000 = 600)", r.status === 201 && r.json?.total === 3900, short(r.json));
r = await order({ customer: cust(), items, discountCode: row?.issued_code });
check("sec", "isti kod nagrade ne može dva puta", r.status === 422, short(r.json));
// Injekcije u polja kupca: upisuju se kao tekst
const evil = cust({ name: `<script>alert('xss')</script>`, street: `"><img src=x onerror=alert(1)>`, city: `'; DROP TABLE orders; --`, note: `=HYPERLINK("http://evil.example","klik")`, email: "xss@example.test", phone: "061 000 020" });
r = await order({ customer: evil, items });
const evilNumber = r.json?.orderNumber;
const evilRow = (await q("SELECT customer_name, city FROM orders WHERE number=?", [evilNumber]))[0];
check("sec", "HTML/SQL u podacima kupca se čuva kao običan tekst, tabele su cele", r.status === 201 && evilRow?.customer_name.includes("<script>") && (await q("SELECT COUNT(*) c FROM orders"))[0].c > 5, short(evilRow));
r = await order({ customer: cust({ email: "csv@example.test", phone: "061 000 021", name: "=cmd|' /C calc'!A0", city: "+SUM(1+1)", street: "@SUM(A1)", note: "-2+3" }), items });
check("pos", "porudžbina sa formulama u poljima (za proveru CSV izvoza)", r.status === 201, short(r.json));
// Unicode, emoji, vrlo dugo ime
r = await order({ customer: cust({ email: "uni@example.test", phone: "061 000 022", name: "Žđćčš 😀 汉字 ‮RTL", street: "Улица 1", city: "Niš" }), items });
const uni = (await q("SELECT customer_name FROM orders WHERE number=?", [r.json?.orderNumber]))[0]?.customer_name;
check("pos", "unicode i emoji u imenu se čuvaju tačno", r.status === 201 && uni === "Žđćčš 😀 汉字 ‮RTL", `${r.status} „${uni}"`);
r = await order({ customer: cust({ email: "dug@example.test", phone: "061 000 023", name: "A".repeat(5000), street: "B".repeat(5000), city: "C".repeat(5000) }), items });
check("neg", "predugačka polja se skraćuju, bez greške servera", r.status === 201, `status ${r.status} ${short(r.text, 120)}`);
r = await order({ customer: cust({ email: "a".repeat(250) + "@example.test", phone: "061 000 024" }), items });
check("neg", "email od 263 znaka (kolona 255): poruka, ne greška servera", r.status === 422, `status ${r.status} ${short(r.text, 160)}`);
r = await order({ customer: cust({ email: "nul@example.test", phone: "061 000 025", name: "Nula\u0000Bajt", street: "Ulica\u0000 1" }), items });
check("neg", "nula-bajt u imenu ne ruši upis", r.status === 201 || r.status === 422, `status ${r.status} ${short(r.text, 160)}`);
r = await order({ customer: cust({ email: "hdr@example.test\r\nBcc: zrtva@example.test", phone: "061 000 026" }), items });
check("sec", "email sa novim redom (ubacivanje zaglavlja) se odbija", r.status === 422, `status ${r.status} ${short(r.json, 160)}`);

section("Javni API: ograničenje broja porudžbina");
const flood = new Session("10.250.1.1");
let limit = null;
for (let i = 1; i <= 13; i++) {
  const res = await order({ customer: cust({ email: `f${i}@example.test`, phone: `062 100 0${10 + i}` }), items: [{ slug: "besplatan-uzorak", qty: 1 }], deliveryMethod: "pickup" }, flood);
  if (res.status === 429) { limit = i; break; }
}
check("sec", "sa jedne adrese: 11. porudžbina u 10 minuta se odbija (429)", limit === 11, `429 na pokušaju ${limit}`);
let passed = 0;
for (let i = 1; i <= 30; i++) {
  const res = await order({ customer: cust({ email: `g${i}@example.test`, phone: `062 200 0${10 + i}` }), items: [{ slug: "besplatan-uzorak", qty: 1 }], deliveryMethod: "pickup" }, new Session(`203.0.113.${i}`));
  if (res.status === 201) passed++;
}
check("sec", "ograničenje NE može da se zaobiđe lažnim X-Forwarded-For zaglavljem", passed === 0, `prošlo ${passed} od 30 porudžbina sa izmišljenim adresama u nekoliko sekundi`);

section("Javni API: CORS i zaglavlja");
r = await s.api("/store", { headers: { origin: "https://evil.example" } });
note(`CORS bez upisanih sajtova: Access-Control-Allow-Origin = ${r.headers.get("access-control-allow-origin")}`);
r = await s.api("/store", { headers: { host: "evil.example", "x-forwarded-host": "evil.example" } });
const leak = JSON.stringify(r.json).includes("evil.example");
r = await s.api("/products/stolica-test", { headers: { "x-forwarded-host": "evil.example", "x-forwarded-proto": "javascript" } });
check("sec", "adrese u odgovoru API-ja ne prate zaglavlje X-Forwarded-Host napadača", !leak && !JSON.stringify(r.json).includes("evil.example"), `store: ${leak}; product: ${short(JSON.stringify(r.json).match(/[a-z]+:\/\/evil[^"]*/)?.[0] ?? "nema")}`);
const home = await s.get("/");
const sec = ["content-security-policy", "x-frame-options", "x-content-type-options", "strict-transport-security", "referrer-policy"].map((h) => `${h}: ${home.headers.get(h) ?? "—"}`);
check("sec", "bezbednosna zaglavlja na stranicama (X-Frame-Options, CSP, nosniff…)", !!home.headers.get("x-frame-options") || /frame-ancestors/.test(home.headers.get("content-security-policy") ?? ""), sec.join("; "));
const adminPage = await s.get("/admin");
check("sec", "panel ne može da se učita u tuđem okviru (clickjacking)", !!adminPage.headers.get("x-frame-options") || /frame-ancestors/.test(adminPage.headers.get("content-security-policy") ?? ""), `x-frame-options: ${adminPage.headers.get("x-frame-options") ?? "—"}`);
check("sec", "server ne otkriva tehnologiju (X-Powered-By)", !home.headers.get("x-powered-by"), `x-powered-by: ${home.headers.get("x-powered-by")}`);

import { writeFileSync } from "node:fs";
writeFileSync(new URL("../state.json", import.meta.url), JSON.stringify({ first, cardOrder, payUrl, evilNumber, reward: row?.issued_code }));
await done();
