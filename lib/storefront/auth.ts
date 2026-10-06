import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { getOrders } from "@/lib/order-store";
import type { Order } from "@/lib/orders";

/**
 * Nalozi kupaca na sajtu prodavnice: registracija, prijava i porudžbine kupca.
 * Odvojeno od prijave u admin panel (lib/admin-auth.ts). Samo za server.
 */

export type ShopUser = { id: number; email: string; firstName: string; lastName: string };

const COOKIE_NAME = "demoshop-session";
const DAY_SECONDS = 60 * 60 * 24;
/** Sa „Zapamti me" prijava važi 30 dana; bez toga do zatvaranja pregledača, a najduže jedan dan. */
const REMEMBER_SECONDS = DAY_SECONDS * 30;

function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toUser(row: RowDataPacket): ShopUser {
  return { id: row.id, email: row.email, firstName: row.first_name, lastName: row.last_name };
}

/** Pravi nalog; null kada nalog sa tom adresom već postoji. */
export async function createUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}): Promise<ShopUser | null> {
  const db = await getDb();
  try {
    const [result] = await db.query<ResultSetHeader>(
      "INSERT INTO shop_users (email, first_name, last_name, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      [input.email, input.firstName, input.lastName, hashPassword(input.password), new Date()],
    );
    return { id: result.insertId, email: input.email, firstName: input.firstName, lastName: input.lastName };
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return null;
    throw error;
  }
}

/** Kupac sa tom adresom i lozinkom, ili null. */
export async function checkUser(email: string, password: string): Promise<ShopUser | null> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT * FROM shop_users WHERE email = ?", [email]);
  // Heš se računa i kada naloga nema, da vreme odgovora ne otkrije koje adrese postoje.
  const stored = rows.length > 0 ? rows[0].pass_hash : hashPassword("", "00");
  const matches = passwordMatches(password, stored);
  return rows.length > 0 && matches ? toUser(rows[0]) : null;
}

export async function startSession(userId: number, remember: boolean) {
  const token = randomBytes(32).toString("base64url");
  const seconds = remember ? REMEMBER_SECONDS : DAY_SECONDS;
  const db = await getDb();
  await db.query("DELETE FROM shop_sessions WHERE expires_at < ?", [new Date()]);
  await db.query("INSERT INTO shop_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
    tokenHash(token),
    userId,
    new Date(Date.now() + seconds * 1000),
  ]);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: seconds } : {}),
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await (await getDb()).query("DELETE FROM shop_sessions WHERE token_hash = ?", [tokenHash(token)]);
  }
  store.delete(COOKIE_NAME);
}

/** Prijavljeni kupac, ili null. */
export const getCurrentUser = cache(async (): Promise<ShopUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>(
    `SELECT u.* FROM shop_sessions s JOIN shop_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [tokenHash(token), new Date()],
  );
  return rows.length > 0 ? toUser(rows[0]) : null;
});

/** Vezuje porudžbinu za nalog sa kog je napravljena. */
export async function linkOrder(userId: number, orderNumber: string) {
  await (
    await getDb()
  ).query("INSERT IGNORE INTO shop_user_orders (user_id, order_number) VALUES (?, ?)", [
    userId,
    orderNumber,
  ]);
}

/**
 * Porudžbine napravljene sa ovog naloga, najnovija prva. Namerno ne po email adresi:
 * adresa pri registraciji nije potvrđena, pa bi tuđe porudžbine bile vidljive svakome ko je upiše.
 */
export async function getUserOrders(userId: number): Promise<Order[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT order_number FROM shop_user_orders WHERE user_id = ?", [userId]);
  if (rows.length === 0) return [];
  const numbers = new Set(rows.map((row) => String(row.order_number)));
  return (await getOrders()).filter((order) => numbers.has(order.number)).reverse();
}
