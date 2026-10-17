import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getStoredValue, setStoredValue } from "@/lib/content";
import { getDb } from "@/lib/db";
import { DUMMY_HASH, hashPassword, passwordMatches } from "@/lib/password";
import { generateRecoveryCodes, generateSecret, totpStep } from "@/lib/totp";

/**
 * Prijava u admin panel i korisnici panela. Korisnici su u bazi (tabela admin_users), svaki
 * sa ulogom koja određuje šta sme da vidi i menja. Sesija je nasumičan žeton u kolačiću, čiji
 * je heš u bazi; važi sedam dana.
 *
 * Prvi vlasnik nastaje iz .env.local (ADMIN_USERNAME i ADMIN_PASSWORD), pri prvoj prijavi dok
 * je tabela korisnika prazna. Posle toga se korisnici vode u panelu, a .env više ne služi za prijavu.
 */

export const ADMIN_PATH = "/admin";

const COOKIE_NAME = "shopcrm-admin";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

/* ---------- Uloge ---------- */

/**
 * Uloga: naziv i delovi panela koje vidi. „Vlasnik" je stalna i vidi sve; ostale uloge pravi i
 * menja vlasnik (Korisnici → Uloge), kao „Staff permissions" u Shopify-ju. Korisnike i uloge
 * vidi samo vlasnik, da niko ne može sam sebi da poveća prava.
 */
export type Role = string;
/** Delovi panela za koje se proverava pristup. */
export type Area = "orders" | "catalog" | "discounts" | "content" | "settings" | "users";

export const AREAS: Area[] = ["orders", "catalog", "discounts", "content", "settings", "users"];
/** Delovi koje vlasnik može da da ulozi; korisnici, uloge i dnevnik ostaju samo vlasniku. */
export const ROLE_AREAS: Area[] = ["orders", "catalog", "discounts", "content", "settings"];

export const areaLabels: Record<Area, { label: string; hint: string }> = {
  orders: { label: "Prodaja", hint: "Pregled, porudžbine, kupci, korpe, poruke, utisci i izveštaji" },
  catalog: { label: "Katalog", hint: "Proizvodi, kategorije i kolekcije" },
  discounts: { label: "Popusti", hint: "Popusti i kodovi (odluka o novcu, pa posebno od kataloga)" },
  content: { label: "Sajt", hint: "Stranice, blog, izgled sajta, slike i prevodi" },
  settings: { label: "Podešavanja", hint: "Podešavanja prodavnice i integracije" },
  users: { label: "Korisnici", hint: "Korisnici, uloge i dnevnik" },
};

export type RoleDefinition = { id: Role; name: string; areas: Area[] };

export const OWNER_ROLE: RoleDefinition = { id: "owner", name: "Vlasnik", areas: AREAS };

/** Uloge koje panel ima dok vlasnik ne promeni spisak. */
export const DEFAULT_ROLES: RoleDefinition[] = [
  OWNER_ROLE,
  { id: "sales", name: "Prodaja", areas: ["orders", "catalog", "discounts"] },
  { id: "content", name: "Sadržaj", areas: ["content", "catalog"] },
];

const ROLES_KEY = "admin_roles";

/** Spisak uloga iz zapisa, sveden na ispravne vrednosti; Vlasnik je uvek prvi i ne menja se. */
export function normalizeRoles(value: unknown): RoleDefinition[] {
  const list = Array.isArray(value) ? value : [];
  const roles = list
    .filter((role): role is RoleDefinition => typeof role?.id === "string" && typeof role?.name === "string" && role.id !== OWNER_ROLE.id)
    .map((role) => ({
      id: role.id.slice(0, 60),
      name: role.name.trim().slice(0, 60) || role.id,
      areas: ROLE_AREAS.filter((area) => Array.isArray(role.areas) && role.areas.includes(area)),
    }));
  return [OWNER_ROLE, ...roles];
}

export const getRoles = cache(async (): Promise<RoleDefinition[]> => {
  const stored = await getStoredValue(ROLES_KEY);
  if (stored === null) return DEFAULT_ROLES;
  try {
    return normalizeRoles(JSON.parse(stored));
  } catch {
    return DEFAULT_ROLES;
  }
});

export async function saveRoles(roles: RoleDefinition[]) {
  await setStoredValue(ROLES_KEY, JSON.stringify(normalizeRoles(roles).slice(1)));
}

export function roleCan(role: Role, area: Area, roles: RoleDefinition[] = DEFAULT_ROLES): boolean {
  if (role === OWNER_ROLE.id) return true;
  return roles.find((item) => item.id === role)?.areas.includes(area) ?? false;
}

/** Naziv uloge; uloga koje više nema (obrisana) se prikazuje po oznaci. */
export function roleName(role: Role, roles: RoleDefinition[] = DEFAULT_ROLES): string {
  return roles.find((item) => item.id === role)?.name ?? role;
}

export type AdminUser = {
  id: number;
  username: string;
  name: string;
  /** Adresa na koju stiže link za novu lozinku; prazno dok je korisnik ne upiše. */
  email: string;
  role: Role;
  /** Uključena prijava u dva koraka. */
  totpEnabled: boolean;
  /** Isključen korisnik ne može da se prijavi. */
  disabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

function toUser(row: RowDataPacket): AdminUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email ?? "",
    role: row.role,
    totpEnabled: row.totp_enabled === 1,
    disabled: row.disabled === 1,
    createdAt: (row.created_at as Date).toISOString(),
    ...(row.last_login_at ? { lastLoginAt: (row.last_login_at as Date).toISOString() } : {}),
  };
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ---------- Tajna servera ---------- */

/**
 * Tajna kojom server potpisuje žetone (pregled izmena na sajtu, probno plaćanje). Pravi se
 * sama pri prvoj upotrebi i čuva u bazi; APP_SECRET iz okruženja je zamenjuje.
 */
export const getSecret = cache(async (): Promise<string> => {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  const stored = await getStoredValue("app_secret");
  if (stored) return stored;
  const created = randomBytes(32).toString("hex");
  await setStoredValue("app_secret", created);
  // Ako su dva procesa pravila tajnu u istom trenutku, važi ona koja je ostala upisana.
  return (await getStoredValue("app_secret")) ?? created;
});

/* ---------- Prijava ---------- */

function envOwner(): { username: string; password: string } | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  return username && password ? { username, password } : null;
}

async function countUsers(): Promise<number> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM admin_users");
  return Number(rows[0].total);
}

/** Prvo pokretanje: nema nijednog korisnika ni podataka u okruženju, pa panel nudi pravljenje vlasnika. */
export async function needsSetup(): Promise<boolean> {
  return envOwner() === null && (await countUsers()) === 0;
}

const SETUP_CODE_KEY = "setup_code";

/**
 * Kod za prvo pokretanje. Dok vlasnik nije napravljen, vlasnik bi postao ko prvi otvori /admin;
 * na serveru (npm run start, Docker) zato čarobnjak traži kod koji vidi samo ko vidi server:
 * SETUP_CODE iz okruženja, ili kod koji se napravi sam, čuva u bazi i ispisuje u dnevnik servera.
 * Lokalno (npm run dev) se ne traži. null: kod nije potreban.
 */
export async function setupCode(): Promise<string | null> {
  if (process.env.NODE_ENV !== "production") return null;
  if (process.env.SETUP_CODE) return process.env.SETUP_CODE;
  const stored = await getStoredValue(SETUP_CODE_KEY);
  if (stored) return stored;
  await setStoredValue(SETUP_CODE_KEY, randomBytes(5).toString("hex"));
  // Ako su dva procesa pravila kod u istom trenutku, važi onaj koji je ostao upisan.
  return getStoredValue(SETUP_CODE_KEY);
}

/** Ispisuje kod u dnevnik servera, dok se prikazuje čarobnjak. */
export async function announceSetupCode(): Promise<boolean> {
  const code = await setupCode();
  if (code && !process.env.SETUP_CODE) console.log(`[prvo pokretanje] Kod za pravljenje vlasnika u /admin: ${code}`);
  return code !== null;
}

/** Da li je upisan ispravan kod za prvo pokretanje (ili kod nije potreban). */
export async function checkSetupCode(input: string): Promise<boolean> {
  const code = await setupCode();
  return code === null || safeEqual(input.trim().toLowerCase(), code.toLowerCase());
}

/** Posle prvog vlasnika kod više ne treba. */
export async function clearSetupCode() {
  await setStoredValue(SETUP_CODE_KEY, null);
}

/**
 * Pravi prvog vlasnika. Upis uspeva samo dok je tabela prazna, i kada dva zahteva stignu
 * odjednom; null kada vlasnik već postoji.
 */
export async function createFirstOwner(input: { username: string; name: string; email?: string; password: string }): Promise<AdminUser | null> {
  const db = await getDb();
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO admin_users (username, name, email, pass_hash, role, created_at)
     SELECT ?, ?, ?, ?, 'owner', ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM admin_users)`,
    [input.username, input.name, input.email || null, hashPassword(input.password), new Date()],
  );
  if (result.affectedRows === 0) return null;
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM admin_users WHERE id = ?", [result.insertId]);
  return toUser(rows[0]);
}

export type LoginResult =
  | { ok: true; user: AdminUser }
  | { ok: false; reason: "invalid" | "code-needed" | "code-invalid" };

/**
 * Proverava ime, lozinku i, kada je uključena prijava u dva koraka, kod iz aplikacije ili
 * rezervni kod. Pogrešno ime i pogrešna lozinka daju isti odgovor.
 */
export async function verifyLogin(username: string, password: string, code: string): Promise<LoginResult> {
  const db = await getDb();
  const name = username.trim().toLowerCase();

  // Prvi vlasnik: dok korisnika nema, važe podaci iz .env.local i od njih nastaje nalog.
  const owner = envOwner();
  if (owner && (await countUsers()) === 0) {
    const matches = owner.username.toLowerCase() === name && safeEqual(password, owner.password);
    if (!matches) return { ok: false, reason: "invalid" };
    await db.query(
      "INSERT IGNORE INTO admin_users (username, name, pass_hash, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
      [name, owner.username, hashPassword(password), new Date()],
    );
  }

  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM admin_users WHERE username = ?", [name]);
  const row = rows[0];
  // Heš se proverava i kada korisnika nema, da vreme odgovora ne otkrije koja imena postoje.
  const passwordOk = passwordMatches(password, row?.pass_hash ?? DUMMY_HASH);
  if (!row || !passwordOk || row.disabled === 1) return { ok: false, reason: "invalid" };

  if (row.totp_enabled === 1) {
    const given = code.trim();
    if (given === "") return { ok: false, reason: "code-needed" };
    const step = totpStep(row.totp_secret, given);
    const accepted = step !== null ? await claimTotpStep(row.id, step) : await consumeRecoveryCode(row.id, row.recovery_codes, given);
    if (!accepted) return { ok: false, reason: "code-invalid" };
  }
  return { ok: true, user: toUser(row) };
}

/** Poređenje preko heša: isto traje bez obzira na to koliko se znakova poklapa. */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Kod iz aplikacije važi jednom: pamti se period poslednjeg iskorišćenog koda, a isti ili stariji
 * se odbija. Uslov u upitu važi i kada dve prijave sa istim kodom stignu u istom trenutku.
 */
async function claimTotpStep(userId: number, step: number): Promise<boolean> {
  const [result] = await (await getDb()).query<ResultSetHeader>(
    "UPDATE admin_users SET totp_step = ? WHERE id = ? AND (totp_step IS NULL OR totp_step < ?)",
    [step, userId, step],
  );
  return result.affectedRows === 1;
}

/** Rezervni kod važi jednom: posle upotrebe se briše. */
async function consumeRecoveryCode(userId: number, stored: string | null, input: string): Promise<boolean> {
  const codes: string[] = JSON.parse(stored ?? "[]");
  const hash = tokenHash(input.trim().toUpperCase());
  if (!codes.includes(hash)) return false;
  await (await getDb()).query("UPDATE admin_users SET recovery_codes = ? WHERE id = ?", [
    JSON.stringify(codes.filter((code) => code !== hash)),
    userId,
  ]);
  return true;
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.query("DELETE FROM admin_sessions WHERE expires_at < ?", [new Date()]);
  await db.query("INSERT INTO admin_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
    tokenHash(token),
    userId,
    new Date(Date.now() + SESSION_SECONDS * 1000),
  ]);
  await db.query("UPDATE admin_users SET last_login_at = ? WHERE id = ?", [new Date(), userId]);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: ADMIN_PATH,
    maxAge: SESSION_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await (await getDb()).query("DELETE FROM admin_sessions WHERE token_hash = ?", [tokenHash(token)]);
  store.set(COOKIE_NAME, "", { path: ADMIN_PATH, maxAge: 0 });
}

/** Prijavljeni korisnik panela, ili null. Isključen korisnik se ne računa ni dok mu sesija traje. */
export const getCurrentAdmin = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>(
    `SELECT u.* FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0`,
    [tokenHash(token), new Date()],
  );
  return rows.length > 0 ? toUser(rows[0]) : null;
});

export async function isAdmin(): Promise<boolean> {
  return (await getCurrentAdmin()) !== null;
}

/** Da li prijavljeni korisnik sme u dati deo panela; za rute koje vraćaju fajl. */
export async function hasAccess(area: Area): Promise<boolean> {
  const user = await getCurrentAdmin();
  return user !== null && roleCan(user.role, area, await getRoles());
}

/**
 * Za stranice i akcije panela: ko nije prijavljen vraća se na prijavu, a ko nema ulogu za
 * taj deo panela na svoj nalog, uz poruku. Bez `area` dovoljno je biti prijavljen.
 */
export async function requireAdmin(area?: Area): Promise<AdminUser> {
  const user = await getCurrentAdmin();
  if (!user) redirect(ADMIN_PATH);
  if (area && !roleCan(user.role, area, await getRoles())) {
    redirect(`${ADMIN_PATH}/nalog?greska=${encodeURIComponent("Vaša uloga nema pristup tom delu panela.")}`);
  }
  return user;
}

/* ---------- Korisnici ---------- */

export async function listAdmins(): Promise<AdminUser[]> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT * FROM admin_users ORDER BY id");
  return rows.map(toUser);
}

async function activeOwners(excludeId?: number): Promise<number> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM admin_users WHERE role = 'owner' AND disabled = 0 AND id <> ?", [excludeId ?? 0]);
  return Number(rows[0].total);
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9._@-]{3,100}$/.test(value);
}

export const PASSWORD_MIN = 10;

/** Dodaje korisnika; null kada ime već postoji. */
export async function createAdmin(input: { username: string; name: string; email?: string; password: string; role: Role }): Promise<AdminUser | null> {
  const db = await getDb();
  try {
    const [result] = await db.query<ResultSetHeader>(
      "INSERT INTO admin_users (username, name, email, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [input.username, input.name, input.email || null, hashPassword(input.password), input.role, new Date()],
    );
    const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM admin_users WHERE id = ?", [result.insertId]);
    return toUser(rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return null;
    throw error;
  }
}

/**
 * Menja ime, ulogu i da li je korisnik isključen. Poslednjem aktivnom vlasniku se uloga ne
 * može oduzeti niti se može isključiti: panel bi ostao bez ikoga ko sme u podešavanja.
 */
export async function updateAdmin(id: number, change: { name: string; email: string; role: Role; disabled: boolean }): Promise<"ok" | "last-owner"> {
  if ((change.role !== "owner" || change.disabled) && (await activeOwners(id)) === 0) return "last-owner";
  const db = await getDb();
  await db.query("UPDATE admin_users SET name = ?, email = ?, role = ?, disabled = ? WHERE id = ?", [change.name, change.email || null, change.role, change.disabled, id]);
  if (change.disabled) await db.query("DELETE FROM admin_sessions WHERE user_id = ?", [id]);
  return "ok";
}

/** Nova lozinka odjavljuje korisnika sa svih uređaja, osim sa `keepToken` (njegove trenutne sesije). */
export async function setAdminPassword(id: number, password: string, keepCurrent = false) {
  const db = await getDb();
  await db.query("UPDATE admin_users SET pass_hash = ? WHERE id = ?", [hashPassword(password), id]);
  const token = keepCurrent ? (await cookies()).get(COOKIE_NAME)?.value : undefined;
  await db.query("DELETE FROM admin_sessions WHERE user_id = ? AND token_hash <> ?", [id, token ? tokenHash(token) : ""]);
}

/** Korisnik sam upisuje adresu na koju mu stiže link za novu lozinku. */
export async function setAdminEmail(id: number, email: string) {
  await (await getDb()).query("UPDATE admin_users SET email = ? WHERE id = ?", [email || null, id]);
}

/** Koliko važi link za novu lozinku. */
const RESET_MINUTES = 60;

/**
 * Pravi žeton za novu lozinku korisniku sa tim korisničkim imenom ili email adresom. null kada
 * takvog nema, kada je isključen ili nema upisanu adresu. Raniji žetoni istog korisnika prestaju da važe.
 */
export async function createAdminReset(login: string): Promise<{ token: string; user: AdminUser } | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM admin_users WHERE (username = ? OR email = ?) AND disabled = 0 AND email IS NOT NULL ORDER BY username = ? DESC, id LIMIT 1",
    [login, login, login],
  );
  if (rows.length === 0) return null;
  const token = randomBytes(32).toString("base64url");
  await db.query("DELETE FROM admin_password_resets WHERE user_id = ? OR expires_at < ?", [rows[0].id, new Date()]);
  await db.query("INSERT INTO admin_password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
    tokenHash(token),
    rows[0].id,
    new Date(Date.now() + RESET_MINUTES * 60_000),
  ]);
  return { token, user: toUser(rows[0]) };
}

/** Da li link za novu lozinku još važi. */
export async function isAdminResetValid(token: string): Promise<boolean> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT 1 FROM admin_password_resets WHERE token_hash = ? AND expires_at > ?", [tokenHash(token), new Date()]);
  return rows.length > 0;
}

/** Postavlja lozinku po žetonu iz linka i odjavljuje korisnika sa svih uređaja; null kada žeton ne važi. */
export async function resetAdminPassword(token: string, password: string): Promise<AdminUser | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT u.* FROM admin_password_resets r JOIN admin_users u ON u.id = r.user_id
     WHERE r.token_hash = ? AND r.expires_at > ? AND u.disabled = 0`,
    [tokenHash(token), new Date()],
  );
  if (rows.length === 0) return null;
  await db.query("DELETE FROM admin_password_resets WHERE user_id = ?", [rows[0].id]);
  await setAdminPassword(rows[0].id, password);
  return toUser(rows[0]);
}

export async function checkAdminPassword(id: number, password: string): Promise<boolean> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT pass_hash FROM admin_users WHERE id = ?", [id]);
  return passwordMatches(password, rows[0]?.pass_hash ?? DUMMY_HASH);
}

export async function deleteAdmin(id: number): Promise<"ok" | "last-owner"> {
  if ((await activeOwners(id)) === 0) return "last-owner";
  const db = await getDb();
  await db.query("DELETE FROM admin_sessions WHERE user_id = ?", [id]);
  await db.query("DELETE FROM admin_users WHERE id = ?", [id]);
  return "ok";
}

/* ---------- Prijava u dva koraka ---------- */

/** Počinje podešavanje: pravi tajnu za aplikaciju. Uključuje se tek kada korisnik potvrdi kodom. */
export async function beginTotp(id: number): Promise<string> {
  const secret = generateSecret();
  await (await getDb()).query("UPDATE admin_users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?", [secret, id]);
  return secret;
}

export async function pendingTotpSecret(id: number): Promise<string | null> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT totp_secret FROM admin_users WHERE id = ? AND totp_enabled = 0", [id]);
  return rows[0]?.totp_secret ?? null;
}

/** Uključuje prijavu u dva koraka ako je kod iz aplikacije ispravan. Vraća rezervne kodove, koji se vide samo sada. */
export async function enableTotp(id: number, code: string): Promise<string[] | null> {
  const secret = await pendingTotpSecret(id);
  const step = secret ? totpStep(secret, code) : null;
  if (step === null) return null;
  const codes = generateRecoveryCodes();
  // Kod kojim je uključeno ne može odmah i za prijavu.
  await (
    await getDb()
  ).query("UPDATE admin_users SET totp_enabled = 1, recovery_codes = ?, totp_step = ? WHERE id = ?", [JSON.stringify(codes.map((item) => tokenHash(item))), step, id]);
  return codes;
}

export async function disableTotp(id: number) {
  await (await getDb()).query("UPDATE admin_users SET totp_enabled = 0, totp_secret = NULL, recovery_codes = NULL, totp_step = NULL WHERE id = ?", [id]);
}

/* ---------- Pregled nesačuvanih izmena na sajtu ---------- */

const PREVIEW_SECONDS = 60 * 60 * 12;

async function signPreview(expires: string): Promise<string> {
  return createHmac("sha256", `shopcrm-preview:${await getSecret()}`).update(expires).digest("hex");
}

/**
 * Žeton za pregled nesačuvanih izmena stranice na sajtu. Kolačić panela važi samo za /admin,
 * pa uređivač sajtu šalje ovaj žeton u adresi; važi dvanaest sati.
 */
export async function previewToken(): Promise<string> {
  const expires = String(Date.now() + PREVIEW_SECONDS * 1000);
  return `${expires}.${await signPreview(expires)}`;
}

export async function isPreviewToken(token: string | undefined): Promise<boolean> {
  const [expires, signature] = (token ?? "").split(".");
  if (!expires || !signature || !/^\d+$/.test(expires)) return false;
  if (!safeEqual(signature, await signPreview(expires))) return false;
  return Number(expires) > Date.now();
}
