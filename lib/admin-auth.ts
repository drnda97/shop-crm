import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Prijava u admin panel: jedan nalog, podaci u .env.local
 * (ADMIN_USERNAME i ADMIN_PASSWORD). Sesija je potpisan kolačić koji važi
 * sedam dana; promena lozinke odjavljuje sve postojeće sesije.
 */

export const ADMIN_PATH = "/admin";

const COOKIE_NAME = "shopcrm-admin";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function credentials(): { username: string; password: string } | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  return username && password ? { username, password } : null;
}

export function isAdminConfigured(): boolean {
  return credentials() !== null;
}

/** Poređenje preko heša: isto traje bez obzira na to koliko se znakova poklapa. */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

function sign(expires: string, password: string): string {
  return createHmac("sha256", `shopcrm-admin:${password}`).update(expires).digest("hex");
}

export function checkCredentials(username: string, password: string): boolean {
  const expected = credentials();
  if (!expected) return false;
  // Oba poređenja se uvek izvrše, da vreme odgovora ne otkrije koje polje je pogrešno.
  const userOk = safeEqual(username, expected.username);
  const passOk = safeEqual(password, expected.password);
  return userOk && passOk;
}

export async function createSession() {
  const expected = credentials();
  if (!expected) return;
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  (await cookies()).set(COOKIE_NAME, `${expires}.${sign(expires, expected.password)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: ADMIN_PATH,
    maxAge: SESSION_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).set(COOKIE_NAME, "", { path: ADMIN_PATH, maxAge: 0 });
}

export async function isAdmin(): Promise<boolean> {
  const expected = credentials();
  if (!expected) return false;
  const value = (await cookies()).get(COOKIE_NAME)?.value ?? "";
  const [expires, signature] = value.split(".");
  if (!expires || !signature) return false;
  if (!safeEqual(signature, sign(expires, expected.password))) return false;
  return Number(expires) > Date.now();
}

/** Za stranice i akcije panela: ko nije prijavljen, vraća se na prijavu. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect(ADMIN_PATH);
}
