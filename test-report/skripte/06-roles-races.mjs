import { readFileSync, existsSync } from "node:fs";
import { createHmac } from "node:crypto";
import { Session, check, section, done, q, short, note, ACTIONS, BASE } from "./h.mjs";
const state = JSON.parse(readFileSync(new URL("../state.json", import.meta.url)));
const mailFile = new URL("../mails.jsonl", import.meta.url);
const mails = () => (existsSync(mailFile) ? readFileSync(mailFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const decode = (data) => data.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errOf = (r) => decodeURIComponent(r.redirect?.match(/greska=(.*)$/)?.[1] ?? r.value?.error ?? "");
const login = async (username, password = "Lozinka-12345", code = "") => {
  const s = new Session();
  s.loginResult = await s.act("login", { prev: true, form: { username, password, code } }, { path: "/admin" });
  return s;
};
const cust = (i) => ({ name: `Trka Kupac ${i}`, phone: `066 300 ${String(1000 + i)}`, email: `trka${i}@example.test`, street: "Ulica 1", city: "Beograd", postalCode: "11000", note: "" });
const order = (body) => new Session().api("/orders", { method: "POST", body });
const owner = await login("vlasnik");
let r;

section("Uloge: prodaja i sadržaj ne smeju u tuđe delove");
const sales = await login("prodaja");
const content = await login("sadrzaj");
check("pos", "prijava korisnika sa ulogom prodaja i sadržaj", sales.loginResult.redirect === "/admin" && content.loginResult.redirect === "/admin", `${sales.loginResult.redirect} / ${content.loginResult.redirect}`);
const denied = (res) => /nalog\?greska=/.test(res.redirect ?? "") || /nalog\?greska=/.test(res.location ?? "") || res.status === 404;
for (const [who, session, pages] of [
  ["prodaja", sales, ["/admin/podesavanja", "/admin/korisnici", "/admin/dnevnik", "/admin/integracije", "/admin/stranice", "/admin/izgled", "/admin/slike", "/admin/blog", "/admin/prevodi", "/admin/podesavanja/sablon", "/admin/podesavanja/pregled"]],
  ["sadržaj", content, ["/admin/podesavanja", "/admin/korisnici", "/admin/dnevnik", "/admin/integracije", "/admin/porudzbine", `/admin/porudzbine/${state.first}`, "/admin/kupci", "/admin/poruke", "/admin/izvestaji", "/admin/korpe", "/admin/utisci", "/admin/porudzbine/izvoz", "/admin/kupci/izvoz", "/admin/poruke/izvoz", "/admin/izvestaji/izvoz", `/admin/porudzbine/${state.first}/racun`, "/admin/popusti"]],
]) {
  for (const path of pages) {
    r = await session.get(path);
    const leaked = r.status === 200 && !/greska/.test(r.text.slice(0, 500));
    check("sec", `uloga ${who}: ${path} je zatvoren`, denied(r) || [302, 303, 307].includes(r.status), `status ${r.status} → ${r.location ?? ""}${leaked ? " SADRŽAJ PRIKAZAN" : ""}`);
  }
}
// Akcije pozvane direktno (zaobilazeći meni)
const tries = [
  [sales, "prodaja", "saveStoreAction", { form: { name: "Hakovano", currency: "RSD" } }],
  [sales, "prodaja", "saveMailAction", { form: { smtpHost: "evil.example", smtpPort: "25" } }],
  [sales, "prodaja", "createUserAction", { form: { username: "novivlasnik", name: "X", password: "Lozinka-12345", role: "owner" } }],
  [sales, "prodaja", "updateUserAction", { form: { id: "2", name: "Ja", role: "owner" } }],
  [sales, "prodaja", "resetUserPasswordAction", { form: { id: "1", password: "Hakovana-lozinka-1" } }],
  [sales, "prodaja", "deleteUserAction", { form: { id: "1" } }],
  [sales, "prodaja", "createApiKeyAction", { prev: true, form: { name: "kradja", scope: "write" } }],
  [sales, "prodaja", "saveAccessAction", { form: {} }],
  [sales, "prodaja", "createWebhookAction", { form: { url: "http://127.0.0.1:3999/kradja", events: ["order.created"] } }],
  [sales, "prodaja", "savePaymentAction", { form: { bank: "on", bankInstructions: "Uplatite na račun napadača" } }],
  [sales, "prodaja", "savePageAction", [{ slug: "pocetna", title: "Hakovano", sections: [] }]],
  [sales, "prodaja", "uploadImageAction", { form: {} }],
  [sales, "prodaja", "saveShippingAction", [[{ name: "Hak", price: "0" }]]],
  [sales, "prodaja", "resetUserTotpAction", { form: { id: "1" } }],
  [content, "sadržaj", "setOrderStatusAction", { form: { number: state.first, status: "cancelled" } }],
  [content, "sadržaj", "refundOrderAction", { form: { number: state.first, amount: "100" } }],
  [content, "sadržaj", "eraseCustomerAction", { form: { key: "t641234567" } }],
  [content, "sadržaj", "createManualOrderAction", [{ customer: cust(900), items: [{ slug: "deset-komada", qty: 1 }] }]],
  [content, "sadržaj", "setOrderPaidAction", { form: { number: state.first, paid: "yes" } }],
  [content, "sadržaj", "sendCampaignAction", { form: { subject: "Spam", body: "Spam poruka svima" } }],
  [content, "sadržaj", "deleteMessageAction", { form: { id: "1" } }],
  [content, "sadržaj", "saveStoreAction", { form: { name: "Hakovano", currency: "RSD" } }],
  [content, "sadržaj", "saveThemeAction", { form: { themeId: "default" } }],
];
const snapshot = async () => JSON.stringify([
  (await q("SELECT value FROM settings WHERE name='settings'"))[0].value.length,
  (await q("SELECT COUNT(*) c FROM admin_users"))[0].c, (await q("SELECT COUNT(*) c FROM api_keys"))[0].c, (await q("SELECT COUNT(*) c FROM webhooks"))[0].c,
  (await q("SELECT status, refunded, paid_at FROM orders WHERE number=?", [state.first]))[0], (await q("SELECT COUNT(*) c FROM orders"))[0].c, (await q("SELECT role FROM admin_users WHERE username='prodaja'"))[0].role,
  (await q("SELECT COUNT(*) c FROM shop_messages"))[0].c, (await q("SELECT title FROM pages WHERE slug='pocetna'"))[0]?.title,
]);
const snapBefore = await snapshot();
for (const [session, who, action, args] of tries) {
  r = await session.act(action, args, { path: "/admin" });
  check("sec", `uloga ${who}: akcija ${action} se odbija`, denied(r), `redirect ${r.redirect} ${short(r.value ?? "", 80)}`);
}
check("sec", "posle svih pokušaja ništa nije promenjeno u bazi", snapBefore === (await snapshot()), `${snapBefore.slice(0, 120)} / ${(await snapshot()).slice(0, 120)}`);
// Šta uloge smeju
r = await sales.get("/admin/porudzbine");
check("pos", "prodaja vidi porudžbine", r.status === 200 && /Petar/.test(r.text), `status ${r.status}`);
r = await content.get("/admin/stranice");
check("pos", "sadržaj vidi stranice", r.status === 200, `status ${r.status}`);
r = await sales.act("changePasswordAction", { form: { current: "pogresna", password: "Nova-lozinka-prodaja" } }, { path: "/admin/nalog" });
check("neg", "promena sopstvene lozinke traži ispravnu trenutnu", /nije ispravna/.test(errOf(r)), errOf(r));
r = await sales.act("changePasswordAction", { form: { current: "Lozinka-12345", password: "123" } }, { path: "/admin/nalog" });
check("neg", "nova lozinka kraća od 10 se odbija", /najmanje/.test(errOf(r)), errOf(r));

section("Bez prijave: nijedna akcija panela ne radi");
const anon = new Session();
let open = [];
for (const name of Object.keys(ACTIONS)) {
  if (!/^(actions|user-actions|blog-actions):/.test(name)) continue;
  const short_ = name.split(":")[1];
  if (["login", "logout", "setupAction", "forgotPasswordAction", "newPasswordAction"].includes(short_)) continue;
  // Akcije prodavnice dele ime fajla „actions"; one su javne po nameni.
  if (["loginAction", "logoutAction", "registerAction", "cartProductsAction", "deleteAccountAction", "requestResetAction", "resetPasswordAction", "returnRequestAction", "saveAddressAction", "trackOrderAction", "unsubscribeNewsletterAction", "placeOrderAction", "quoteAction", "saveCartAction", "contactAction", "subscribeAction", "reviewAction", "unsubscribeCartAction"].includes(short_)) continue;
  const res = await anon.act(name, { form: { id: "1", slug: "stolica-test", number: String(state.first), name: "x", key: "x" } }, { path: "/admin" });
  if (res.redirect !== "/admin") open.push(`${short_}→${res.redirect ?? res.status}`);
}
check("sec", "svih ~75 akcija panela bez prijave vraća na stranu za prijavu", open.length === 0, open.join(", "));
check("sec", "…i baza je ostala ista", snapBefore === (await snapshot()));

section("Sesije i korisnici");
const cookie = owner.cookies.get("shopcrm-admin");
check("sec", "kolačić panela nije čitljiv iz baze (čuva se heš)", (await q("SELECT COUNT(*) c FROM admin_sessions WHERE token_hash=?", [cookie]))[0].c === 0);
const forged = new Session(); forged.cookies.set("shopcrm-admin", "izmisljen-token-123");
r = await forged.get("/admin/porudzbine");
check("sec", "izmišljen kolačić ne otvara panel", /name="password"/.test(r.text) && !/Petar/.test(r.text), `status ${r.status}`);
// Isključen korisnik odmah gubi pristup
const sid = (await q("SELECT id FROM admin_users WHERE username='sadrzaj'"))[0].id;
r = await owner.act("updateUserAction", { form: { id: sid, name: "Korisnik content", role: "content", disabled: "on", email: "sadrzaj@example.test" } }, { path: "/admin/korisnici" });
r = await content.get("/admin/stranice");
check("sec", "isključen korisnik odmah gubi pristup (postojeća sesija)", !(r.status === 200 && /Početna|pocetna/.test(r.text) && !/name="password"/.test(r.text)), `status ${r.status}`);
r = (await login("sadrzaj")).loginResult;
check("sec", "isključen korisnik ne može da se prijavi", !r.redirect, short(r.value));
// Nova lozinka od vlasnika odjavljuje korisnika
const pid = (await q("SELECT id FROM admin_users WHERE username='prodaja'"))[0].id;
await owner.act("resetUserPasswordAction", { form: { id: pid, password: "Sasvim-nova-lozinka-1", username: "prodaja" } }, { path: "/admin/korisnici" });
r = await sales.get("/admin/porudzbine");
check("sec", "nova lozinka odjavljuje korisnika sa svih uređaja", /name="password"/.test(r.text), `status ${r.status}`);
// Poslednji vlasnik
const oid = (await q("SELECT id FROM admin_users WHERE username='vlasnik'"))[0].id;
const o2 = (await q("SELECT id FROM admin_users WHERE username='drugivlasnik'"))[0].id;
r = await owner.act("deleteUserAction", { form: { id: oid } }, { path: "/admin/korisnici" });
check("neg", "vlasnik ne može da obriše sam sebe", /sopstveni/.test(errOf(r)), errOf(r));
r = await owner.act("updateUserAction", { form: { id: oid, name: "Vlasnik", role: "owner", disabled: "on" } }, { path: "/admin/korisnici" });
check("neg", "vlasnik ne može da isključi sam sebe", /sopstveni/.test(errOf(r)), errOf(r));
await owner.act("deleteUserAction", { form: { id: o2 } }, { path: "/admin/korisnici" });
r = await owner.act("updateUserAction", { form: { id: oid, name: "Vlasnik", role: "sales" } }, { path: "/admin/korisnici" });
check("neg", "poslednji vlasnik ne može sebi da oduzme ulogu", /bar jedan/.test(errOf(r)) && (await q("SELECT role FROM admin_users WHERE id=?", [oid]))[0].role === "owner", errOf(r));
// Odjava
const temp = await login("vlasnik");
const tok = temp.cookies.get("shopcrm-admin");
await temp.act("logout", [], { path: "/admin" });
const replay = new Session(); replay.cookies.set("shopcrm-admin", tok);
r = await replay.get("/admin/porudzbine");
check("sec", "posle odjave stari kolačić više ne važi", /name="password"/.test(r.text), `status ${r.status}`);
const setCookie = (await (async () => { const x = new Session(); const res = await x.fetch("/admin", { method: "POST", headers: { "next-action": ACTIONS["actions:login"], origin: BASE }, body: (() => { const f = new FormData(); f.append("_1_username", "vlasnik"); f.append("_1_password", "Lozinka-12345"); f.append("0", '[{},"$K1"]'); return f; })() }); return res.headers.getSetCookie().join(" | "); })());
check("sec", "kolačić panela: HttpOnly, SameSite, samo za /admin", /HttpOnly/i.test(setCookie) && /SameSite=lax/i.test(setCookie) && /Path=\/admin/i.test(setCookie), setCookie.replace(/=[\w-]{20,}/, "=…"));
note(`oznaka Secure na kolačiću: ${/Secure/i.test(setCookie) ? "da" : "ne (server je pokrenut preko http; u produkciji zavisi od NODE_ENV)"}`);

section("Prijava u dva koraka (TOTP)");
const b32 = (text) => { const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const c of text) bits += A.indexOf(c).toString(2).padStart(5, "0"); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
const totp = (secret, time = Date.now()) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(time / 30000))); const d = createHmac("sha1", b32(secret)).update(c).digest(); const o = d[d.length - 1] & 15; return String((d.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); };
await owner.act("createUserAction", { form: { username: "dvakoraka", name: "Dva Koraka", password: "Lozinka-12345", role: "sales" } }, { path: "/admin/korisnici" });
const two = await login("dvakoraka");
r = await two.act("startTotpAction", [], { path: "/admin/nalog" });
const secret = (await q("SELECT totp_secret FROM admin_users WHERE username='dvakoraka'"))[0].totp_secret;
r = await two.act("confirmTotpAction", { prev: true, form: { code: "000000" } }, { path: "/admin/nalog" });
check("neg", "pogrešan kod pri uključivanju", !!r.value?.error, short(r.value));
r = await two.act("confirmTotpAction", { prev: true, form: { code: totp(secret) } }, { path: "/admin/nalog" });
const recovery = r.value?.codes ?? [];
check("pos", "uključivanje prijave u dva koraka + 8 rezervnih kodova", recovery.length === 8, short(r.value));
r = (await login("dvakoraka")).loginResult;
check("sec", "lozinka sama više nije dovoljna (traži se kod)", r.value?.needCode === true && !r.redirect, short(r.value));
r = (await login("dvakoraka", "Lozinka-12345", "123456")).loginResult;
check("sec", "pogrešan kod se odbija", !r.redirect && !!r.value?.error, short(r.value));
const code = totp(secret);
r = (await login("dvakoraka", "Lozinka-12345", code)).loginResult;
check("pos", "prijava sa ispravnim kodom", r.redirect === "/admin", short(r.value ?? r.redirect));
r = (await login("dvakoraka", "Lozinka-12345", code)).loginResult;
check("sec", "isti jednokratni kod ne može ponovo (replay)", !r.redirect, r.redirect ? "isti kod je prihvaćen drugi put u istih 30–90 sekundi" : short(r.value));
r = (await login("dvakoraka", "Lozinka-12345", recovery[0])).loginResult;
check("pos", "prijava rezervnim kodom", r.redirect === "/admin", short(r.value ?? r.redirect));
r = (await login("dvakoraka", "Lozinka-12345", recovery[0])).loginResult;
check("sec", "rezervni kod važi samo jednom", !r.redirect, short(r.value));
r = (await login("dvakoraka", "pogresna", code)).loginResult;
check("sec", "ispravan kod bez ispravne lozinke ne prolazi", !r.redirect && !r.value?.needCode, short(r.value));
// Nagađanje koda: 10 pokušaja po adresi, ali adresa se bira zaglavljem
let guessed = 0;
for (let i = 0; i < 25; i++) { const g = (await login("dvakoraka", "Lozinka-12345", String(100000 + i))).loginResult; if (!/Previše/.test(g.value?.error ?? "")) guessed++; }
check("sec", "nagađanje koda iz aplikacije je ograničeno po nalogu", guessed <= 10, `${guessed} od 25 pokušaja koda je provereno (svaki sa druge „adrese“); nema brojača po nalogu`);

section("Zaboravljena lozinka panela");
let m0 = mails().length;
r = await anon.act("forgotPasswordAction", { prev: true, form: { login: "nepostoji" } }, { path: "/admin-lozinka" });
const a1 = JSON.stringify(r.value);
r = await anon.act("forgotPasswordAction", { prev: true, form: { login: "prodaja" } }, { path: "/admin-lozinka" });
check("sec", "isti odgovor za postojećeg i nepostojećeg korisnika", a1 === JSON.stringify(r.value) && r.value?.sent === true, `${a1} / ${JSON.stringify(r.value)}`);
await wait(900);
let mail = mails().slice(m0).find((m) => m.to.some((t) => t.includes("prodaja@")));
let link = mail ? decode(mail.data).match(/https?:\/\/[^\s"<]+\/admin-lozinka\/[\w-]+/)?.[0] : null;
check("pos", "link za novu lozinku stiže na adresu korisnika", !!link, `link: ${link}`);
const token = link?.split("/").pop();
r = await anon.act("newPasswordAction", { prev: true, form: { token: "pogresan", password: "Nova-lozinka-panel-1", repeat: "Nova-lozinka-panel-1" } }, { path: "/admin-lozinka/x" });
check("sec", "nova lozinka sa pogrešnim žetonom", /ne važi/.test(r.value?.error ?? ""), short(r.value));
r = await anon.act("newPasswordAction", { prev: true, form: { token, password: "Nova-lozinka-panel-1", repeat: "drugacije" } }, { path: "/admin-lozinka/x" });
check("neg", "lozinke se ne poklapaju", /poklapaju/.test(r.value?.error ?? ""), short(r.value));
r = await anon.act("newPasswordAction", { prev: true, form: { token, password: "Nova-lozinka-panel-1", repeat: "Nova-lozinka-panel-1" } }, { path: "/admin-lozinka/x" });
check("pos", "postavljanje nove lozinke preko linka", r.value?.done === true, short(r.value));
r = await anon.act("newPasswordAction", { prev: true, form: { token, password: "Jos-jedna-lozinka-2", repeat: "Jos-jedna-lozinka-2" } }, { path: "/admin-lozinka/x" });
check("sec", "link važi samo jednom", /ne važi/.test(r.value?.error ?? ""), short(r.value));
check("pos", "prijava novom lozinkom", (await login("prodaja", "Nova-lozinka-panel-1")).loginResult.redirect === "/admin");
// Podmetnut Host
m0 = mails().length;
const f = new FormData(); f.append("_1_login", "prodaja"); f.append("0", '[{},"$K1"]');
const res = await new Session().fetch("/admin-lozinka", { method: "POST", headers: { "next-action": ACTIONS["user-actions:forgotPasswordAction"], origin: "https://evil.example", host: "evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" }, body: f });
await res.text(); await wait(900);
mail = mails().slice(m0).find((m) => m.to.some((t) => t.includes("prodaja@")));
link = mail ? decode(mail.data).match(/https?:\/\/[^\s"<]+\/admin-lozinka\/[\w-]+/)?.[0] : null;
check("sec", "link za lozinku PANELA ne prati podmetnut Host/X-Forwarded-Host", !link || !link.includes("evil.example"), `status ${res.status}; link u emailu korisniku: ${link ?? "nije poslat"}`);

section("Istovremene porudžbine (trke)");
// 20 kupaca u istom trenutku poručuje poslednji komad
let results = await Promise.all(Array.from({ length: 20 }, (_, i) => order({ customer: cust(i), items: [{ slug: "poslednji-komad", qty: 1 }], deliveryMethod: "pickup" })));
let won = results.filter((x) => x.status === 201).length;
let left = (await q("SELECT stock_qty FROM products WHERE slug='poslednji-komad'"))[0].stock_qty;
check("sec", "20 istovremenih porudžbina za poslednji komad: prolazi tačno jedna", won === 1 && left === 0 && results.every((x) => [201, 422].includes(x.status)), `uspelo ${won}, stanje ${left}, statusi ${[...new Set(results.map((x) => x.status))].join()}`);
// 30 kupaca × 1 komad, na stanju 10 (jedan je već prodat u testu webhook-a)
const start = (await q("SELECT stock_qty FROM products WHERE slug='deset-komada'"))[0].stock_qty;
results = await Promise.all(Array.from({ length: 30 }, (_, i) => order({ customer: cust(100 + i), items: [{ slug: "deset-komada", qty: 1 }], deliveryMethod: "pickup" })));
won = results.filter((x) => x.status === 201).length;
left = (await q("SELECT stock_qty FROM products WHERE slug='deset-komada'"))[0].stock_qty;
const sold = (await q("SELECT COALESCE(SUM(i.qty),0) s FROM order_items i JOIN orders o ON o.number=i.order_number WHERE i.slug='deset-komada' AND o.email LIKE 'trka1%' AND o.status<>'cancelled'"))[0].s;
check("sec", `30 istovremenih porudžbina na ${start} komada: nema prodaje preko stanja`, won === start && left === 0 && Number(sold) === start, `uspelo ${won}, stanje ${left}, prodato ${sold}; statusi ${[...new Set(results.map((x) => x.status))].join()}`);
check("pos", "brojevi porudžbina su jedinstveni i redom", new Set(results.filter((x) => x.status === 201).map((x) => x.json.orderNumber)).size === won);
// Promo kod za 3 korišćenja, 15 istovremenih
await owner.act("saveDiscountAction", { form: { name: "Tri puta", trigger: "public", code: "TRIPUTA", kind: "percent", percent: "50", maxUses: "3", status: "active" } }, { path: "/admin/popusti/novi" });
results = await Promise.all(Array.from({ length: 15 }, (_, i) => order({ customer: cust(200 + i), items: [{ slug: "besplatan-uzorak", qty: 1 }, { slug: "stolica-test", qty: 1 }], discountCode: "TRIPUTA", deliveryMethod: "pickup" })));
won = results.filter((x) => x.status === 201).length;
const used = (await q("SELECT COUNT(*) c FROM orders WHERE discount_code='TRIPUTA'"))[0].c;
check("sec", "kod za 3 korišćenja uz 15 istovremenih porudžbina: tačno 3", won === 3 && used === 3, `uspelo ${won}, u bazi ${used}`);
// Kod nagrade: 10 istovremenih pokušaja istog kupca
const rew = (await q("SELECT code, email, phone FROM discount_codes WHERE used_order IS NULL AND email<>'' ORDER BY id DESC LIMIT 1"))[0];
if (rew) {
  results = await Promise.all(Array.from({ length: 10 }, () => order({ customer: { ...cust(300), email: rew.email, phone: rew.phone }, items: [{ slug: "stolica-test", qty: 1 }], discountCode: rew.code, deliveryMethod: "pickup" })));
  won = results.filter((x) => x.status === 201).length;
  check("sec", "kod nagrade uz 10 istovremenih porudžbina: iskorišćen jednom", won === 1, `uspelo ${won}; statusi ${results.map((x) => x.status).join()}`);
}
// Otkazivanje i vraćanje iste porudžbine istovremeno
const stA = (await q("SELECT stock_qty FROM products WHERE slug='stolica-test'"))[0].stock_qty;
const target = (await q("SELECT o.number FROM orders o JOIN order_items i ON i.order_number=o.number WHERE i.slug='stolica-test' AND o.status='new' AND i.qty=1 ORDER BY o.number DESC LIMIT 1"))[0].number;
await Promise.all(Array.from({ length: 12 }, (_, i) => owner.act("setOrderStatusAction", { form: { number: target, status: i % 2 ? "new" : "cancelled" } }, { path: "/admin/porudzbine" })));
const finalStatus = (await q("SELECT status FROM orders WHERE number=?", [target]))[0].status;
const stZ = (await q("SELECT stock_qty FROM products WHERE slug='stolica-test'"))[0].stock_qty;
check("sec", "12 istovremenih otkazivanja/vraćanja iste porudžbine: stanje ostaje tačno", stZ === stA + (finalStatus === "cancelled" ? 1 : 0), `stanje ${stA} → ${stZ}, završni status ${finalStatus}`);
// Dve istovremene izmene kataloga (ceo katalog se prepisuje)
const cnt = (await q("SELECT COUNT(*) c FROM products"))[0].c;
const adds = await Promise.all(Array.from({ length: 8 }, (_, i) => owner.act("saveProductAction", { form: { name: `Istovremeni ${i}`, price: "100", status: "draft" } }, { path: "/admin/proizvodi/novi" })));
const cnt2 = (await q("SELECT COUNT(*) c FROM products"))[0].c;
check("sec", "8 istovremenih dodavanja proizvoda: nijedan se ne gubi", cnt2 === cnt + 8, `${cnt} → ${cnt2} (očekivano ${cnt + 8}); ${adds.map((a) => a.redirect ?? a.status).join()}`);
// Izmena kataloga dok stižu porudžbine: stanje koje je panel učitao ne sme da pregazi prodaju
await owner.act("saveProductAction", { form: { name: "Trka Stanje", price: "100", stockQty: "50", status: "active" } }, { path: "/admin/proizvodi/novi" });
const mix = await Promise.all([
  ...Array.from({ length: 10 }, (_, i) => order({ customer: cust(400 + i), items: [{ slug: "trka-stanje", qty: 1 }], deliveryMethod: "pickup" })),
  ...Array.from({ length: 5 }, (_, i) => owner.act("saveProductAction", { form: { name: `Uz Trku ${i}`, price: "100", status: "draft" } }, { path: "/admin/proizvodi/novi" })),
]);
const okOrders = mix.slice(0, 10).filter((x) => x.status === 201).length;
const stT = (await q("SELECT stock_qty FROM products WHERE slug='trka-stanje'"))[0].stock_qty;
check("sec", "izmene kataloga u panelu dok stižu porudžbine ne vraćaju prodate komade na stanje", stT === 50 - okOrders, `porudžbina ${okOrders}, stanje ${stT} (očekivano ${50 - okOrders})`);

section("Napuštene korpe i novosti");
await owner.act("saveAbandonedAction", { form: { enabled: "on", delayHours: "1", subject: "Zaboravili ste korpu", text: "Vaša korpa vas čeka." } }, { path: "/admin/korpe" });
const shopper = new Session();
r = await shopper.act("saveCartAction", [{ email: "korpa@example.test", firstName: "Kora", items: [{ slug: "stolica-test", qty: 2 }, { slug: "nacrt-proizvod", qty: 1 }] }], { path: "/placanje" });
let cart = (await q("SELECT * FROM abandoned_carts WHERE email='korpa@example.test'"))[0];
check("pos", "korpa se pamti uz email (nacrt ispada)", !!cart && JSON.parse(cart.items).length === 1, short(cart?.items));
// Podmetnut Host: link u podsetniku
const f2 = await new Session().fetch("/placanje", { method: "POST", headers: { "next-action": ACTIONS["actions:saveCartAction"], origin: "https://evil.example", host: "evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https", "content-type": "text/plain;charset=UTF-8" }, body: JSON.stringify([{ email: "zrtva@example.test", firstName: "Žrtva", items: [{ slug: "stolica-test", qty: 1 }] }]) });
await f2.text();
const victimCart = (await q("SELECT site_url FROM abandoned_carts WHERE email='zrtva@example.test'"))[0];
await q("UPDATE abandoned_carts SET updated_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 HOUR)");
m0 = mails().length;
r = await owner.act("sendRemindersAction", [], { path: "/admin/korpe" });
await wait(1200);
const rem = mails().slice(m0);
check("pos", "podsetnik za korpu se šalje posle isteka vremena", rem.some((m) => m.to.some((t) => t.includes("korpa@"))), `${decodeURIComponent(r.redirect ?? "")}; poruka: ${rem.length}`);
const victimMail = rem.find((m) => m.to.some((t) => t.includes("zrtva@")));
const vLink = victimMail ? decode(victimMail.data).match(/https?:\/\/[^\s"<]+\/korpa\/vrati\/[0-9a-f]+/)?.[0] : null;
check("sec", "bilo ko ne može da pošalje TUĐOJ adresi email prodavnice sa linkom na svoj sajt", !vLink || !vLink.includes("evil.example"), `site_url u bazi: ${victimCart?.site_url}; link u emailu žrtvi: ${vLink ?? "nije poslat"}`);
m0 = mails().length;
await owner.act("sendRemindersAction", [], { path: "/admin/korpe" });
await wait(800);
check("pos", "podsetnik se ne šalje dva puta", mails().length === m0, `novih poruka: ${mails().length - m0}`);
cart = (await q("SELECT token FROM abandoned_carts WHERE email='korpa@example.test'"))[0];
r = await anon.get(`/korpa/vrati/${cart.token}`);
check("pos", "link iz podsetnika vraća korpu", r.status === 200 && /stolica-test/.test(r.text), `status ${r.status}`);
r = await anon.get(`/korpa/vrati/${"0".repeat(48)}`);
check("sec", "izmišljen žeton korpe ne vraća ništa", r.status === 200 && !/stolica-test/.test(r.text), `status ${r.status}`);
r = await anon.act("unsubscribeCartAction", [cart.token], { path: "/" });
check("pos", "odjava od podsetnika", r.value === true, short(r.value));
// Novosti
m0 = mails().length;
r = await owner.act("sendCampaignAction", { form: { subject: "Jesenja akcija", body: "Poštovani,\n\nstigla je nova kolekcija. <script>alert(1)</script>" } }, { path: "/admin/poruke" });
await wait(2500);
const camp = mails().slice(m0);
const subs = (await q("SELECT COUNT(*) c FROM shop_subscribers WHERE unsubscribed=0"))[0].c;
check("pos", "poruka svim prijavljenima na novosti", camp.length === subs && subs > 0, `${decodeURIComponent(r.redirect ?? "")}; poslato ${camp.length}, prijavljenih ${subs}`);
check("sec", "HTML u tekstu novosti je izbegnut u emailu", camp.length > 0 && !/<script>alert\(1\)<\/script>/.test(decode(camp[0].data)), "");
const unsub = camp.length ? decode(camp[0].data).match(/\/novosti\/odjava\/([0-9a-f]{48})/)?.[1] : null;
r = await anon.act("unsubscribeNewsletterAction", [unsub ?? "x"], { path: "/" });
check("pos", "odjava od novosti preko linka", r.value === true, `žeton ${unsub?.slice(0, 8)}… → ${short(r.value)}`);
r = await anon.act("unsubscribeNewsletterAction", ["' OR 1=1 --"], { path: "/" });
check("sec", "odjava sa izmišljenim žetonom ne odjavljuje nikoga", r.value === false, short(r.value));

section("Email o porudžbini");
const orderMails = mails().filter((m) => /petar@example\.test/.test(m.to.join()));
const sellerMails = mails().filter((m) => /vlasnik@example\.test/.test(m.to.join()));
check("pos", "kupac dobija potvrdu porudžbine", orderMails.length >= 1, `poruka kupcu petar@: ${orderMails.length}`);
check("pos", "prodavac dobija obaveštenje o porudžbini", sellerMails.length >= 5, `poruka prodavcu: ${sellerMails.length}`);
const xssMail = mails().find((m) => /xss@example\.test/.test(m.to.join()));
const xssBody = xssMail ? decode(xssMail.data) : "";
check("sec", "ime kupca sa <script> je izbegnuto u emailu", !!xssMail && !/<script>alert\('xss'\)<\/script>/.test(xssBody), xssMail ? "" : "poruka nije nađena");
const sellerXss = mails().filter((m) => /vlasnik@example\.test/.test(m.to.join())).map((m) => decode(m.data)).find((b) => /xss@example\.test/.test(b));
check("sec", "…i u emailu prodavcu", !!sellerXss && !/<script>alert\('xss'\)<\/script>|<img src=x onerror/.test(sellerXss), sellerXss ? "" : "poruka nije nađena");
const errors = await q("SELECT number, email_error FROM orders WHERE email_error IS NOT NULL LIMIT 5");
check("pos", "nijedna porudžbina nema upisanu grešku slanja emaila", errors.length === 0, JSON.stringify(errors).slice(0, 300));

section("Brisanje podataka kupca i dnevnik");
const key = (await q("SELECT customer_key FROM orders WHERE email='ana@example.test'"))[0].customer_key;
r = await owner.act("eraseCustomerAction", { form: { key } }, { path: "/admin/kupci" });
const erased = (await q("SELECT customer_name, email, phone, street FROM orders WHERE customer_key LIKE 'obrisan-%'"))[0];
check("pos", "brisanje podataka kupca: porudžbina ostaje bez ličnih podataka", erased?.customer_name === "Obrisan kupac" && erased.email === "" && erased.phone === "", short(erased));
const audit = await q("SELECT action, detail, user_name FROM audit_log ORDER BY id DESC LIMIT 400");
check("pos", "dnevnik beleži izmene (ko i šta)", audit.length > 50 && audit.some((a) => /Obrisani podaci kupca/.test(a.action)), `zapisa: ${audit.length}`);
check("sec", "dnevnik ne sadrži lozinke", !audit.some((a) => /Lozinka-12345|Nova-lozinka|Sasvim-nova/.test(a.detail)), "");
check("sec", "neuspele prijave u panel se beleže u dnevnik", audit.some((a) => /neuspe|pogrešn/i.test(a.action)), "u dnevniku nema nijednog zapisa o pogrešnoj lozinci, iako ih je bilo preko 40");

await done();
process.exit(0);
