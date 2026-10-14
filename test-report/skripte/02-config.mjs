import { Session, check, section, done, q, short, note } from "./h.mjs";

export async function owner() {
  const s = new Session();
  const r = await s.act("login", { prev: true, form: { username: "vlasnik", password: "Lozinka-12345" } }, { path: "/admin" });
  if (r.redirect !== "/admin") throw new Error("prijava vlasnika nije uspela: " + short(r.value));
  return s;
}
const s = await owner();
const P = "/admin/podesavanja";
const okRedirect = (r) => /[?&]ok=/.test(r.redirect ?? "") || (r.redirect && !/greska=/.test(r.redirect));
const errOf = (r) => (r.redirect?.match(/greska=(.*)$/)?.[1] ?? r.value?.error ?? r.error ?? "");

section("Podešavanja prodavnice");
const store = { name: "Probna Radnja", currency: "RSD", currencyDecimals: "0", locale: "sr-Latn-RS", timeZone: "Europe/Belgrade", phonePrefix: "381", codePrefix: "KOD", email: "radnja@example.test", phone: "011 123 456", address: "Glavna 1, Beograd", language: "sr", languages: "en", panelLanguage: "sr", storefrontUrl: "http://127.0.0.1:3100", allowedOrigins: "" };
let r = await s.act("saveStoreAction", { form: store }, { path: P });
check("pos", "čuvanje podataka prodavnice", okRedirect(r), r.redirect ?? short(r.text));
r = await s.act("saveStoreAction", { form: { ...store, name: "" } }, { path: P });
check("neg", "prodavnica bez naziva se odbija", /naziv/.test(errOf(r)), errOf(r));
r = await s.act("saveStoreAction", { form: { ...store, timeZone: "Mars/Olympus" } }, { path: P });
check("neg", "neispravna vremenska zona se odbija", /zonu/.test(errOf(r)), errOf(r));
r = await s.act("saveStoreAction", { form: { ...store, allowedOrigins: "javascript:alert(1)" } }, { path: P });
check("neg", "neispravna adresa sajta (CORS) se odbija", /nije ispravna/.test(errOf(r)), errOf(r));
r = await s.act("saveStoreAction", { form: { ...store, email: "nije-email" } }, { path: P });
check("neg", "neispravan email prodavnice se odbija", /adresu/.test(errOf(r)), errOf(r));

section("Dostava, plaćanje, PDV, email");
r = await s.act("saveShippingAction", [[
  { id: "kurir", name: "Kurirska služba", hint: "2-3 dana", kind: "delivery", price: "500", freeFrom: "20000", weightRates: [], zone: "", confirmation: "Stiže za 2-3 dana." },
  { id: "bg-brza", name: "Brza dostava Beograd", hint: "danas", kind: "delivery", price: "900", freeFrom: "", weightRates: [{ upTo: "5", price: "900" }, { upTo: "20", price: "1500" }], zone: "11", confirmation: "Stiže danas." },
  { id: "preuzimanje", name: "Lično preuzimanje", hint: "", kind: "pickup", price: "0", freeFrom: "", weightRates: [], zone: "", confirmation: "Čekamo vas." },
]], { path: P });
check("pos", "čuvanje tri načina dostave", r.value?.ok === true, short(r.value ?? r.text));
r = await s.act("saveShippingAction", [[]], { path: P });
check("neg", "dostava bez ijednog načina se odbija", r.value?.ok === false, short(r.value));
r = await s.act("saveShippingAction", [[{ name: "X", price: "abc" }]], { path: P });
check("neg", "dostava sa cenom koja nije broj se odbija", r.value?.ok === false, short(r.value));
r = await s.act("saveShippingAction", [[{ name: "Minus", price: "-500" }]], { path: P });
check("neg", "dostava sa negativnom cenom se odbija", r.value?.ok === false, short(r.value));

r = await s.act("savePaymentAction", { form: { cod: "on", bank: "on", bankInstructions: "Račun 160-000000-00, poziv na broj: broj porudžbine", card: "on", cardProvider: "test", returns: "on" } }, { path: P });
check("pos", "plaćanje: pouzeće + račun + kartica (probni procesor)", okRedirect(r), r.redirect);
r = await s.act("savePaymentAction", { form: {} }, { path: P });
check("neg", "plaćanje bez ijednog načina se odbija", /Bar jedan/.test(errOf(r)), errOf(r));
r = await s.act("savePaymentAction", { form: { bank: "on", bankInstructions: "" } }, { path: P });
check("neg", "uplata na račun bez podataka se odbija", /podatke za uplatu/.test(errOf(r)), errOf(r));

r = await s.act("saveTaxAction", { form: { taxEnabled: "on", taxPercent: "20", legal: "Probna Radnja DOO, PIB 123456789", invoiceEmail: "none" } }, { path: P });
check("pos", "PDV 20%", okRedirect(r), r.redirect);
r = await s.act("saveTaxAction", { form: { taxEnabled: "on", taxPercent: "150" } }, { path: P });
check("neg", "PDV 150% se odbija", /0 do 100/.test(errOf(r)), errOf(r));

r = await s.act("saveMailAction", { form: { notifySeller: "on", notifyCustomer: "on", sellerEmail: "vlasnik@example.test", fromName: "Probna Radnja", fromEmail: "prodaja@example.test", smtpHost: "127.0.0.1", smtpPort: "2525", smtpUser: "", smtpPassword: "" } }, { path: P });
check("pos", "SMTP (lokalni lažni server)", okRedirect(r), r.redirect);
r = await s.act("saveMailAction", { form: { smtpHost: "127.0.0.1", smtpPort: "99999" } }, { path: P });
check("neg", "SMTP port van opsega se odbija", /Port/.test(errOf(r)), errOf(r));
r = await s.act("sendTestEmailAction", [], { path: P });
check("pos", "probni email stiže", okRedirect(r), r.redirect ?? short(r.text));

section("Kategorije i proizvodi");
for (const [label, parent] of [["Stolice", ""], ["Fotelje", ""], ["Barske stolice", "stolice"]]) {
  r = await s.act("createCategoryAction", { form: { label, parent } }, { path: "/admin/kategorije" });
  check("pos", `kategorija „${label}"`, r.redirect === "/admin/kategorije", r.redirect ?? short(r.text));
}
r = await s.act("createCategoryAction", { form: { label: "   " } }, { path: "/admin/kategorije" });
check("neg", "kategorija bez naziva se odbija", /naziv/.test(errOf(r)), errOf(r));

const PP = "/admin/proizvodi/novi";
const add = async (kind, title, form, expect) => {
  const res = await s.act("saveProductAction", { form }, { path: PP });
  const ok = expect ? expect.test(errOf(res)) : res.redirect === "/admin/proizvodi";
  check(kind, title, ok, res.redirect ?? short(res.error ?? res.text, 200));
  return res;
};
await add("pos", "proizvod sa brojem komada", { name: "Stolica Test", category: "stolice", price: "10000", stockQty: "5", weight: "4000", sku: "ST-1", summary: "Hrast", description: "Opis stolice.", status: "active" });
await add("pos", "proizvod na akciji, bez vođenja stanja", { name: "Lampa Akcija", price: "5000", salePrice: "4000", status: "active" });
await add("pos", "proizvod sa varijantama", {
  name: "Fotelja Varijante", category: "fotelje", price: "30000", status: "active", options: "Boja: Crvena #ff0000, Plava #0000ff\nNoge: Hrast, Orah",
  variants: JSON.stringify({ "crvena-hrast": { stockQty: "2" }, "crvena-orah": { price: "35000", salePrice: "33000", stockQty: "1", sku: "FV-CO" }, "plava-hrast": { enabled: false }, "plava-orah": { stockQty: "0" } }),
});
await add("pos", "proizvod kao nacrt", { name: "Nacrt Proizvod", price: "1000", status: "draft" });
await add("pos", "proizvod koji nije na stanju", { name: "Nema Na Stanju", price: "2000", inStock: "no", status: "active" });
await add("pos", "proizvod bez cene", { name: "Bez Cene", status: "active" });
await add("pos", "proizvod: poslednji komad", { name: "Poslednji Komad", price: "7000", stockQty: "1", status: "active" });
await add("pos", "proizvod: deset komada", { name: "Deset Komada", price: "1000", stockQty: "10", status: "active", category: "barske-stolice" });
await add("pos", "proizvod sa HTML-om u nazivu i opisu", { name: `<img src=x onerror=alert(1)>"'XSS`, price: "1500", status: "active", summary: `"><script>alert(2)</script>`, description: `<script>alert(3)</script><b>bold</b>`, attributes: `<svg onload=alert(4)>: <iframe src=javascript:alert(5)>` });
await add("pos", "proizvod besplatan (cena 0)", { name: "Besplatan Uzorak", price: "0", status: "active" });

await add("neg", "proizvod bez naziva", { name: "", price: "100" }, /naziv/);
await add("neg", "cena koja nije broj", { name: "Los", price: "abc" }, /Cena je broj/);
await add("neg", "negativna cena", { name: "Los", price: "-100" }, /Cena je broj/);
await add("neg", "akcijska cena viša od redovne", { name: "Los", price: "100", salePrice: "200" }, /niža/);
await add("neg", "negativan broj komada", { name: "Los", price: "100", stockQty: "-3" }, /ceo broj/);
await add("neg", "broj komada sa decimalom", { name: "Los", price: "100", stockQty: "1.5" }, /ceo broj/);
await add("neg", "naziv samo od znakova (bez slova)", { name: "!!!???", price: "100" }, /slovo ili cifru/);
await add("neg", "više od 100 kombinacija varijanti", { name: "Los", price: "100", options: "A: 1,2,3,4,5,6\nB: 1,2,3,4,5,6\nC: 1,2,3,4,5,6" }, /kombinacija/);

// Prevelika cena: INT kolona u bazi (najviše 2.147.483.647)
const before = (await q("SELECT COUNT(*) c FROM products"))[0].c;
const big = await s.act("saveProductAction", { form: { name: "Preskup", price: "99999999999", status: "active" } }, { path: PP, raw: true });
const after = (await q("SELECT COUNT(*) c FROM products"))[0].c;
check("neg", "cena veća od 2.147.483.647 daje poruku, ne grešku servera", big.status < 500 && /greska=/.test(big.headers.get("x-action-redirect") ?? ""), `HTTP ${big.status}, redirect ${big.headers.get("x-action-redirect")}; ${short(big.text, 160)}`);
check("sec", "…i katalog je posle toga ceo (proizvoda pre/posle)", after === before || after === before + 1, `${before} → ${after}`);
const sci = await s.act("saveProductAction", { form: { name: "Naucni Zapis", price: "1e3", status: "draft" } }, { path: PP });
note(`cena "1e3": ${sci.redirect} → u bazi ${(await q("SELECT price FROM products WHERE slug='naucni-zapis'"))[0]?.price}`);
const hex = await s.act("saveProductAction", { form: { name: "Hex Zapis", price: "0x10", status: "draft" } }, { path: PP });
note(`cena "0x10": ${hex.redirect} → u bazi ${(await q("SELECT price FROM products WHERE slug='hex-zapis'"))[0]?.price}`);
check("neg", "cena „0x10“ / „1e3“ se ne prihvata kao broj", /greska/.test(hex.redirect ?? "") && /greska/.test(sci.redirect ?? ""), `1e3 → ${sci.redirect}; 0x10 → ${hex.redirect}`);

// Dva proizvoda istog naziva dobijaju različite oznake
await add("pos", "drugi proizvod istog naziva", { name: "Stolica Test", price: "11000", status: "draft" });
const slugs = (await q("SELECT slug FROM products WHERE name='Stolica Test' ORDER BY slug")).map((x) => x.slug);
check("pos", "isti naziv → različite oznake (slug)", slugs.join() === "stolica-test,stolica-test-2", slugs.join());

console.log((await q("SELECT slug, price, sale_price, stock_qty, active, in_stock FROM products ORDER BY position")).map((x) => JSON.stringify(x)).join("\n"));
console.log((await q("SELECT product_slug, id, price, sale_price, stock_qty, enabled FROM product_variants")).map((x) => JSON.stringify(x)).join("\n"));

section("Popusti");
const D = "/admin/popusti/novi";
const disc = async (kind, title, form, expect) => {
  const res = await s.act("saveDiscountAction", { form }, { path: D });
  check(kind, title, expect ? expect.test(errOf(res)) : res.redirect === "/admin/popusti", res.redirect ?? short(res.error ?? res.text, 200));
};
await disc("pos", "promo kod 10%", { name: "Leto", trigger: "public", code: "leto10", kind: "percent", percent: "10", status: "active" });
await disc("pos", "promo kod fiksni iznos 2000, najmanja korpa 15000", { name: "Dve hiljade", trigger: "public", code: "MINUS2000", kind: "amount", amount: "2000", threshold: "15000", status: "active" });
await disc("pos", "promo kod besplatna dostava", { name: "Besplatna dostava", trigger: "public", code: "DOSTAVA", kind: "shipping", status: "active" });
await disc("pos", "promo kod za jedno korišćenje", { name: "Jednom", trigger: "public", code: "JEDNOM", kind: "percent", percent: "50", maxUses: "1", status: "active" });
await disc("pos", "promo kod koji je istekao", { name: "Istekao", trigger: "public", code: "ISTEKAO", kind: "percent", percent: "50", expiresAt: "2020-01-01", status: "active" });
await disc("pos", "promo kod u nacrtu", { name: "Nacrt kod", trigger: "public", code: "NACRT", kind: "percent", percent: "50", status: "draft" });
await disc("pos", "promo kod 100%", { name: "Sve dzabe", trigger: "public", code: "STO", kind: "percent", percent: "100", status: "active" });
await disc("pos", "promo kod samo za kategoriju fotelje", { name: "Fotelje 20", trigger: "public", code: "FOTELJE20", kind: "percent", percent: "20", categories: "fotelje", status: "active" });
await disc("pos", "nagrada posle prve porudžbine 15%", { name: "Hvala na prvoj kupovini", trigger: "first", percent: "15", status: "active" });
await disc("neg", "promo kod bez koda", { name: "X", trigger: "public", kind: "percent", percent: "10" }, /mora imati/);
await disc("neg", "popust 0%", { name: "X", trigger: "public", code: "NULA", kind: "percent", percent: "0" }, /1 do 100/);
await disc("neg", "popust 150%", { name: "X", trigger: "public", code: "VISE", kind: "percent", percent: "150" }, /1 do 100/);
await disc("neg", "kod sa nedozvoljenim znacima", { name: "X", trigger: "public", code: "ŠĆ<>", kind: "percent", percent: "10" }, /3–32/);
await disc("neg", "kod koji već postoji", { name: "X", trigger: "public", code: "LETO10", kind: "percent", percent: "10" }, /već koristi/);
await disc("neg", "nepoznata vrsta popusta", { name: "X", trigger: "hack", code: "ABC", percent: "10" }, /vrstu/);
await disc("neg", "broj korišćenja 0", { name: "X", trigger: "public", code: "ABC", kind: "percent", percent: "10", maxUses: "0" }, /veći od nule/);
await disc("neg", "neispravan datum", { name: "X", trigger: "public", code: "ABC", kind: "percent", percent: "10", expiresAt: "sutra" }, /datum/);

section("Pristup spolja i API ključevi");
r = await s.act("saveAccessAction", { form: { publicApi: "on", adminApi: "on", webhooks: "on" } }, { path: "/admin/integracije" });
check("pos", "uključen javni API, API sa ključem i webhook-ovi", /ok=/.test(r.redirect ?? ""), r.redirect);
const keys = {};
for (const scope of ["read", "write"]) {
  r = await s.act("createApiKeyAction", { prev: true, form: { name: `Test ${scope}`, scope } }, { path: "/admin/integracije" });
  keys[scope] = r.value?.key;
  check("pos", `API ključ (${scope})`, /^sk_[0-9a-f]{48}$/.test(r.value?.key ?? ""), short(r.value));
}
r = await s.act("createApiKeyAction", { prev: true, form: { name: "" } }, { path: "/admin/integracije" });
check("neg", "API ključ bez naziva se odbija", !!r.value?.error, short(r.value));
const stored = await q("SELECT key_hash, prefix FROM api_keys");
check("sec", "u bazi je samo heš ključa, ne ceo ključ", stored.every((row) => !Object.values(keys).includes(row.key_hash) && row.key_hash.length === 64), JSON.stringify(stored.map((x) => x.prefix)));

section("Korisnici panela i uloge");
for (const [username, role] of [["prodaja", "sales"], ["sadrzaj", "content"], ["drugivlasnik", "owner"]]) {
  r = await s.act("createUserAction", { form: { username, name: `Korisnik ${role}`, password: "Lozinka-12345", role, email: `${username}@example.test` } }, { path: "/admin/korisnici" });
  check("pos", `korisnik sa ulogom ${role}`, /ok=/.test(r.redirect ?? ""), r.redirect);
}
r = await s.act("createUserAction", { form: { username: "prodaja", name: "Dupli", password: "Lozinka-12345", role: "sales" } }, { path: "/admin/korisnici" });
check("neg", "korisnik sa zauzetim imenom se odbija", /već postoji/.test(errOf(r)), errOf(r));
r = await s.act("createUserAction", { form: { username: "kratka", name: "K", password: "123", role: "sales" } }, { path: "/admin/korisnici" });
check("neg", "korisnik sa kratkom lozinkom se odbija", /najmanje/.test(errOf(r)), errOf(r));
r = await s.act("createUserAction", { form: { username: "uloga", name: "K", password: "Lozinka-12345", role: "superadmin" } }, { path: "/admin/korisnici" });
const made = (await q("SELECT role FROM admin_users WHERE username='uloga'"))[0]?.role;
check("neg", "nepoznata uloga ne postaje vlasnik", made === "sales" || made === undefined, `uloga u bazi: ${made}`);

import { writeFileSync } from "node:fs";
writeFileSync(new URL("../keys.json", import.meta.url), JSON.stringify(keys));
await done();
