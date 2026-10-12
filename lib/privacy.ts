import type { RowDataPacket } from "mysql2/promise";
import { getCustomers } from "@/lib/customers";
import { getDb } from "@/lib/db";
import { getOrders } from "@/lib/order-store";

/**
 * Podaci o ličnosti na zahtev kupca: izvoz svega što prodavnica čuva o njemu, i brisanje.
 * Porudžbine se ne brišu (prodavac ih mora čuvati kao evidenciju prodaje), već se iz njih
 * uklanjaju ime, kontakt i adresa. Samo za server.
 */

async function rowsFor(sql: string, values: unknown[]): Promise<RowDataPacket[]> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>(sql, values);
  return rows;
}

/** Sve što je sačuvano o kupcu, za predaju kupcu na zahtev; null kada kupac ne postoji. */
export async function exportCustomer(key: string) {
  const customer = getCustomers(await getOrders()).find((candidate) => candidate.key === key);
  if (!customer) return null;
  const emails = [...new Set(customer.orders.map((order) => order.customer.email.toLowerCase()).filter(Boolean))];
  const numbers = customer.orders.map((order) => order.number);
  const byEmail = async (sql: string) => (emails.length > 0 ? rowsFor(sql, [emails]) : []);

  return {
    kupac: { ime: customer.name, telefon: customer.phone, email: customer.email, adresa: `${customer.street}, ${customer.postalCode} ${customer.city}` },
    porudzbine: customer.orders,
    nalog: await byEmail("SELECT email, first_name, last_name, phone, street, city, postal_code, created_at FROM shop_users WHERE LOWER(email) IN (?)"),
    poruke: await byEmail("SELECT created_at, name, email, topic, body FROM shop_messages WHERE LOWER(email) IN (?)"),
    novosti: await byEmail("SELECT email, created_at, unsubscribed FROM shop_subscribers WHERE LOWER(email) IN (?)"),
    korpe: await byEmail("SELECT email, first_name, items, updated_at FROM abandoned_carts WHERE LOWER(email) IN (?)"),
    zahtevi_za_povrat: await rowsFor("SELECT order_number, created_at, items, reason, status, answer FROM return_requests WHERE order_number IN (?)", [numbers]),
    beleska_prodavca: (await rowsFor("SELECT note FROM customer_notes WHERE customer_key = ?", [key]))[0]?.note ?? "",
  };
}

/**
 * Briše podatke kupca: nalog, poruke, prijavu na novosti, sačuvanu korpu i belešku, a iz
 * porudžbina uklanja ime, telefon, email, adresu i napomenu. Ne može da se vrati.
 * Vraća broj porudžbina iz kojih su podaci uklonjeni.
 */
export async function eraseCustomer(key: string): Promise<number> {
  const customer = getCustomers(await getOrders()).find((candidate) => candidate.key === key);
  if (!customer) return 0;
  const db = await getDb();
  const emails = [...new Set(customer.orders.map((order) => order.customer.email.toLowerCase()).filter(Boolean))];
  const numbers = customer.orders.map((order) => order.number);

  if (emails.length > 0) {
    const [users] = await db.query<RowDataPacket[]>("SELECT id FROM shop_users WHERE LOWER(email) IN (?)", [emails]);
    for (const { id } of users) {
      for (const table of ["shop_sessions", "shop_user_orders", "password_resets"]) await db.query(`DELETE FROM ${table} WHERE user_id = ?`, [id]);
      await db.query("UPDATE reviews SET name = 'Kupac', user_id = 0 WHERE user_id = ?", [id]);
      await db.query("DELETE FROM shop_users WHERE id = ?", [id]);
    }
    for (const table of ["shop_messages", "shop_subscribers", "abandoned_carts"]) {
      await db.query(`DELETE FROM ${table} WHERE LOWER(email) IN (?)`, [emails]);
    }
  }
  await db.query("DELETE FROM customer_notes WHERE customer_key = ?", [key]);
  await db.query("UPDATE discount_codes SET email = '', phone = '' WHERE issued_order IN (?)", [numbers]);
  await db.query("UPDATE return_requests SET reason = '' WHERE order_number IN (?)", [numbers]);
  // Ključ kupca se menja u oznaku bez podataka, da porudžbine ostanu zajedno u evidenciji.
  await db.query(
    `UPDATE orders SET customer_key = ?, customer_name = 'Obrisan kupac', phone = '', email = '', street = '',
      city = '', postal_code = '', note = '', admin_note = NULL WHERE number IN (?)`,
    [`obrisan-${numbers[numbers.length - 1]}`, numbers],
  );
  return numbers.length;
}
