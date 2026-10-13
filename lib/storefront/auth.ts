import { createHash, randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { getOrders } from "@/lib/order-store";
import type { Order } from "@/lib/orders";
import { DUMMY_HASH, hashPassword, passwordMatches } from "@/lib/password";

/**
 * Nalozi kupaca na sajtu prodavnice: registracija, prijava i porudžbine kupca.
 * Odvojeno od prijave u admin panel (lib/admin-auth.ts). Samo za server.
 */

export type ShopUser = { id: number; email: string; firstName: string; lastName: string };

/** Adresa za dostavu sačuvana uz nalog; popunjava formu pri sledećoj porudžbini. */
export type ShopAddress = { phone: string; street: string; city: string; postalCode: string };

/** Koliko važi link za novu lozinku. */
const RESET_MINUTES = 60;

const COOKIE_NAME = "demoshop-session";
const DAY_SECONDS = 60 * 60 * 24;
/** Sa „Zapamti me" prijava važi 30 dana; bez toga do zatvaranja pregledača, a najduže jedan dan. */
const REMEMBER_SECONDS = DAY_SECONDS * 30;

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
  const stored = rows.length > 0 ? rows[0].pass_hash : DUMMY_HASH;
  const matches = passwordMatches(password, stored);
  return rows.length > 0 && matches ? toUser(rows[0]) : null;
}

/**
 * Kupac koji se prijavio preko Google naloga: postojeći nalog sa tom adresom, ili nov. Adresu je
 * potvrdio Google, pa se nalog sa istom adresom smatra istim kupcem.
 */
export async function findOrCreateUser(input: { email: string; firstName: string; lastName: string }): Promise<ShopUser> {
  const db = await getDb();
  const find = async () => (await db.query<RowDataPacket[]>("SELECT * FROM shop_users WHERE email = ?", [input.email]))[0];
  const existing = await find();
  if (existing.length > 0) return toUser(existing[0]);
  // Nalog nema lozinku koju iko zna; kupac je može postaviti preko „Zaboravljena lozinka".
  const created = await createUser({ ...input, password: randomBytes(32).toString("base64url") });
  return created ?? toUser((await find())[0]);
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

export async function getAddress(userId: number): Promise<ShopAddress> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT phone, street, city, postal_code FROM shop_users WHERE id = ?", [userId]);
  const row = rows[0];
  return { phone: row?.phone ?? "", street: row?.street ?? "", city: row?.city ?? "", postalCode: row?.postal_code ?? "" };
}

export async function saveAddress(userId: number, address: ShopAddress) {
  await (
    await getDb()
  ).query("UPDATE shop_users SET phone = ?, street = ?, city = ?, postal_code = ? WHERE id = ?", [
    address.phone.slice(0, 64),
    address.street.slice(0, 255),
    address.city.slice(0, 255),
    address.postalCode.slice(0, 16),
    userId,
  ]);
}

/**
 * Pravi žeton za novu lozinku za nalog sa tom adresom; null kada naloga nema. Žeton važi sat
 * vremena i jednom; raniji žetoni istog naloga prestaju da važe.
 */
export async function createPasswordReset(email: string): Promise<{ token: string; user: ShopUser } | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM shop_users WHERE email = ?", [email]);
  if (rows.length === 0) return null;
  const token = randomBytes(32).toString("base64url");
  await db.query("DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?", [rows[0].id, new Date()]);
  await db.query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
    tokenHash(token),
    rows[0].id,
    new Date(Date.now() + RESET_MINUTES * 60_000),
  ]);
  return { token, user: toUser(rows[0]) };
}

/** Postavlja novu lozinku po žetonu iz linka. Odjavljuje nalog sa svih uređaja. false: žeton ne važi. */
export async function resetPassword(token: string, password: string): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?",
    [tokenHash(token), new Date()],
  );
  if (rows.length === 0) return false;
  const userId = rows[0].user_id;
  await db.query("UPDATE shop_users SET pass_hash = ? WHERE id = ?", [hashPassword(password), userId]);
  await db.query("DELETE FROM password_resets WHERE user_id = ?", [userId]);
  await db.query("DELETE FROM shop_sessions WHERE user_id = ?", [userId]);
  return true;
}

/** Briše nalog kupca i sve što je vezano samo za nalog. Porudžbine ostaju prodavcu (evidencija prodaje). */
export async function deleteUser(userId: number) {
  const db = await getDb();
  for (const table of ["shop_sessions", "shop_user_orders", "password_resets"]) {
    await db.query(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
  }
  await db.query("UPDATE reviews SET name = 'Kupac', user_id = 0 WHERE user_id = ?", [userId]).catch(() => {});
  await db.query("DELETE FROM shop_users WHERE id = ?", [userId]);
}
