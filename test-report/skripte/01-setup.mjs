import { Session, check, section, done, q, short, note } from "./h.mjs";

section("Prvo pokretanje i prijava u panel");
const anon = new Session();

// Pre podešavanja
let page = await anon.get("/admin");
check("pos", "/admin prikazuje čarobnjak dok nema korisnika", page.status === 200 && /name="repeat"/.test(page.text), `status ${page.status}`);
for (const path of ["/admin/porudzbine", "/admin/podesavanja", "/admin/korisnici", "/admin/porudzbine/izvoz", "/admin/kupci/izvoz", "/admin/proizvodi/izvoz", "/admin/poruke/izvoz", "/admin/izvestaji/izvoz", "/admin/podesavanja/sablon", "/admin/podesavanja/pregled", "/admin/porudzbine/1001/racun", "/admin/kupci/t641234567/podaci"]) {
  const r = await anon.get(path);
  check("sec", `bez prijave: ${path} ne daje sadržaj`, [302, 303, 307, 308, 401, 403, 404].includes(r.status) || /name="repeat"|name="password"/.test(r.text), `status ${r.status}, location ${r.location}, ${short(r.text, 80)}`);
}

// Negativni čarobnjak
const base = { language: "sr", store: "Probna Radnja", email: "radnja@example.test", name: "Vlasnik Test", username: "vlasnik", password: "Lozinka-12345", repeat: "Lozinka-12345" };
let r = await anon.act("setupAction", { prev: true, form: { ...base, password: "kratka", repeat: "kratka" } }, { path: "/admin" });
check("neg", "čarobnjak odbija kratku lozinku", /najmanje 10/.test(r.value?.error ?? ""), short(r.value));
r = await anon.act("setupAction", { prev: true, form: { ...base, repeat: "Drugacija-12345" } }, { path: "/admin" });
check("neg", "čarobnjak odbija različite lozinke", /ne poklapaju/.test(r.value?.error ?? ""), short(r.value));
r = await anon.act("setupAction", { prev: true, form: { ...base, username: "a b<script>" } }, { path: "/admin" });
check("neg", "čarobnjak odbija neispravno korisničko ime", /Korisničko ime/.test(r.value?.error ?? ""), short(r.value));
r = await anon.act("setupAction", { prev: true, form: { ...base, name: "" } }, { path: "/admin" });
check("neg", "čarobnjak traži ime", /ime/.test(r.value?.error ?? ""), short(r.value));

// CSRF: akcija sa tuđeg Origin-a
r = await anon.act("setupAction", { prev: true, form: base }, { path: "/admin", origin: "https://evil.example", raw: true });
check("sec", "server akcija sa tuđeg Origin-a se odbija (CSRF)", r.status >= 400 || !/podesavanja/.test(r.headers.get("x-action-redirect") ?? ""), `status ${r.status} ${short(r.text, 120)}`);
check("sec", "…i vlasnik nije napravljen", (await q("SELECT COUNT(*) c FROM admin_users"))[0].c === 0);

// Trka: dva čarobnjaka u istom trenutku
const [a, b] = await Promise.all([
  new Session().act("setupAction", { prev: true, form: base }, { path: "/admin" }),
  new Session().act("setupAction", { prev: true, form: { ...base, username: "napadac", name: "Napadac" } }, { path: "/admin" }),
]);
const owners = await q("SELECT username, role FROM admin_users");
check("sec", "dva istovremena čarobnjaka prave samo jednog vlasnika", owners.length === 1, JSON.stringify(owners) + ` a=${a.redirect ?? short(a.value)} b=${b.redirect ?? short(b.value)}`);
note(`vlasnik: ${owners[0]?.username}`);
// Ko god da je pobedio, postavljamo poznatog vlasnika.
if (owners[0]?.username !== "vlasnik") {
  await q("DELETE FROM admin_users"); await q("DELETE FROM admin_sessions");
  const again = await new Session().act("setupAction", { prev: true, form: base }, { path: "/admin" });
  note(`ponovljen čarobnjak: ${again.redirect}`);
}
r = await new Session().act("setupAction", { prev: true, form: { ...base, username: "drugi" } }, { path: "/admin" });
check("sec", "čarobnjak ne radi kada vlasnik postoji", /već podešen/.test(r.value?.error ?? ""), short(r.value));

const settings = JSON.parse((await q("SELECT value FROM settings WHERE name='settings'"))[0]?.value ?? "{}");
check("pos", "čarobnjak je upisao naziv i email prodavnice", settings.store?.name === "Probna Radnja" && settings.store?.email === "radnja@example.test", short(settings.store));

// Prijava
section("Prijava u panel");
const s = new Session();
r = await s.act("login", { prev: true, form: { username: "vlasnik", password: "pogresna-lozinka" } }, { path: "/admin" });
check("neg", "pogrešna lozinka", /Pogrešno/.test(r.value?.error ?? ""), short(r.value));
r = await s.act("login", { prev: true, form: { username: "nepostoji", password: "Lozinka-12345" } }, { path: "/admin" });
check("neg", "nepostojeći korisnik daje istu poruku", /Pogrešno/.test(r.value?.error ?? ""), short(r.value));
r = await s.act("login", { prev: true, form: { username: "' OR 1=1 -- ", password: "' OR '1'='1" } }, { path: "/admin" });
check("sec", "SQL injection u prijavi ne prolazi", /Pogrešno/.test(r.value?.error ?? "") && !r.redirect, short(r.value));
r = await s.act("login", { prev: true, form: { username: "VLASNIK ", password: "Lozinka-12345" } }, { path: "/admin" });
check("pos", "prijava ispravnom lozinkom (ime velikim slovima)", r.redirect === "/admin" && s.cookies.has("shopcrm-admin"), `redirect ${r.redirect} ${short(r.value)}`);
const cookieLine = s.cookies.get("shopcrm-admin");
page = await s.get("/admin");
check("pos", "pregled panela se otvara", page.status === 200 && !/name="password"/.test(page.text), `status ${page.status}`);

// Brute force: 10 pokušaja pa blokada
const bf = new Session("10.202.0.1");
let blockedAt = null;
for (let i = 1; i <= 12; i++) {
  const t = await bf.act("login", { prev: true, form: { username: "vlasnik", password: `x${i}` } }, { path: "/admin" });
  if (/Previše/.test(t.value?.error ?? "")) { blockedAt = i; break; }
}
check("sec", "prijava se blokira posle 10 pogrešnih pokušaja", blockedAt === 11, `blokada na pokušaju ${blockedAt}`);
// Zaobilaženje: druga X-Forwarded-For vrednost
const bf2 = new Session("10.202.0.2");
r = await bf2.act("login", { prev: true, form: { username: "vlasnik", password: "x" } }, { path: "/admin" });
check("sec", "blokada prijave NE može da se zaobiđe promenom X-Forwarded-For", /Previše/.test(r.value?.error ?? ""), `sa drugom XFF adresom: ${short(r.value)} (napadač sam bira zaglavlje)`);
// Bez XFF zaglavlja svi dele jedan brojač "unknown"
const noip = new Session(""); noip.ip = "";
let shared = null;
for (let i = 1; i <= 11; i++) {
  const t = await noip.act("login", { prev: true, form: { username: "vlasnik", password: `y${i}` } }, { path: "/admin" });
  if (/Previše/.test(t.value?.error ?? "")) { shared = i; break; }
}
const victim = new Session(""); victim.ip = "";
r = await victim.act("login", { prev: true, form: { username: "vlasnik", password: "Lozinka-12345" } }, { path: "/admin" });
check("sec", "bez proxy-ja: tuđi pogrešni pokušaji NE zaključavaju vlasnika", r.redirect === "/admin", `napadač blokiran na ${shared}; vlasnik sa ispravnom lozinkom dobija: ${r.redirect ?? short(r.value)}`);

console.log("COOKIE=" + cookieLine);
await done();
