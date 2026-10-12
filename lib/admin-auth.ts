import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getStoredValue, setStoredValue } from "@/lib/content";
import { getDb } from "@/lib/db";
import { DUMMY_HASH, hashPassword, passwordMatches } from "@/lib/password";
import { generateRecoveryCodes, generateSecret, verifyTotp } from "@/lib/totp";

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

export type Role = "owner" | "sales" | "content";
/** Delovi panela za koje se proverava pristup. */
export type Area = "orders" | "catalog" | "content" | "settings" | "users";

export const roleLabels: Record<Role, string> = {
  owner: "Vlasnik",
  sales: "Prodaja",
  content: "Sadržaj",
};

export const roleHints: Record<Role, string> = {
  owner: "sve, uključujući podešavanja i korisnike",
  sales: "porudžbine, kupci, poruke, utisci, izveštaji, proizvodi i popusti",
  content: "stranice, izgled sajta, slike i proizvodi",
};

const roleAreas: Record<Role, Area[]> = {
  owner: ["orders", "catalog", "content", "settings", "users"],
  sales: ["orders", "catalog"],
  content: ["content", "catalog"],
};

export function roleCan(role: Role, area: Area): boolean {
  return roleAreas[role].includes(area);
}

export type AdminUser = {
  id: number;
  username: string;
  name: string;
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

/** Da li iko može da se prijavi: postoji korisnik u bazi, ili su upisani podaci prvog vlasnika. */
export async function isAdminConfigured(): Promise<boolean> {
  return envOwner() !== null || (await countUsers()) > 0;
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
    if (!verifyTotp(row.totp_secret, given) && !(await consumeRecoveryCode(row.id, row.recovery_codes, given))) {
      return { ok: false, reason: "code-invalid" };
    }
  }
  return { ok: true, user: toUser(row) };
}

/** Poređenje preko heša: isto traje bez obzira na to koliko se znakova poklapa. */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
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
  return user !== null && roleCan(user.role, area);
}

/**
 * Za stranice i akcije panela: ko nije prijavljen vraća se na prijavu, a ko nema ulogu za
 * taj deo panela na svoj nalog, uz poruku. Bez `area` dovoljno je biti prijavljen.
 */
export async function requireAdmin(area?: Area): Promise<AdminUser> {
  const user = await getCurrentAdmin();
  if (!user) redirect(ADMIN_PATH);
  if (area && !roleCan(user.role, area)) {
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
export async function createAdmin(input: { username: string; name: string; password: string; role: Role }): Promise<AdminUser | null> {
  const db = await getDb();
  try {
    const [result] = await db.query<ResultSetHeader>(
      "INSERT INTO admin_users (username, name, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
      [input.username, input.name, hashPassword(input.password), input.role, new Date()],
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
export async function updateAdmin(id: number, change: { name: string; role: Role; disabled: boolean }): Promise<"ok" | "last-owner"> {
  if ((change.role !== "owner" || change.disabled) && (await activeOwners(id)) === 0) return "last-owner";
  const db = await getDb();
  await db.query("UPDATE admin_users SET name = ?, role = ?, disabled = ? WHERE id = ?", [change.name, change.role, change.disabled, id]);
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
  if (!secret || !verifyTotp(secret, code)) return null;
  const codes = generateRecoveryCodes();
  await (
    await getDb()
  ).query("UPDATE admin_users SET totp_enabled = 1, recovery_codes = ? WHERE id = ?", [JSON.stringify(codes.map((item) => tokenHash(item))), id]);
  return codes;
}

export async function disableTotp(id: number) {
  await (await getDb()).query("UPDATE admin_users SET totp_enabled = 0, totp_secret = NULL, recovery_codes = NULL WHERE id = ?", [id]);
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
