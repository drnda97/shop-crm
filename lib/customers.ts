import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";
import type { Order } from "@/lib/orders";

/**
 * Kupci. Nema posebne tabele kupaca: kupac je skup porudžbina sa istim ključem
 * (telefon, ili email kada telefona nema), a podaci o njemu su iz poslednje
 * porudžbine. U bazi su samo beleške prodavca (tabela customer_notes).
 */

export type Customer = {
  key: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  street: string;
  postalCode: string;
  /** Sve porudžbine, najnovija prva. */
  orders: Order[];
  /** Broj porudžbina koje nisu otkazane. */
  orderCount: number;
  /** Zbir iznosa za naplatu u porudžbinama koje nisu otkazane. */
  spent: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

/** Kupci složeni iz porudžbina; onaj koji je poslednji poručio je prvi. */
export function getCustomers(orders: Order[]): Customer[] {
  const customers = new Map<string, Customer>();
  // Porudžbine stižu od najstarije, pa podaci kupca na kraju budu iz najnovije.
  for (const order of orders) {
    const existing = customers.get(order.customerKey);
    const valid = order.status !== "cancelled";
    customers.set(order.customerKey, {
      key: order.customerKey,
      name: order.customer.name,
      phone: order.customer.phone,
      email: order.customer.email,
      city: order.customer.city,
      street: order.customer.street,
      postalCode: order.customer.postalCode,
      orders: [order, ...(existing?.orders ?? [])],
      orderCount: (existing?.orderCount ?? 0) + (valid ? 1 : 0),
      spent: (existing?.spent ?? 0) + (valid ? order.total : 0),
      firstOrderAt: existing?.firstOrderAt ?? order.receivedAt,
      lastOrderAt: order.receivedAt,
    });
  }
  return [...customers.values()].sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
}

export async function getCustomerNote(key: string): Promise<string> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT note FROM customer_notes WHERE customer_key = ?", [key]);
  return rows.length > 0 ? rows[0].note : "";
}

/** Ključevi kupaca koji imaju belešku, za oznaku u spisku. */
export async function getNotedCustomers(): Promise<Set<string>> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT customer_key FROM customer_notes");
  return new Set(rows.map((row) => row.customer_key));
}

export async function setCustomerNote(key: string, note: string) {
  const db = await getDb();
  if (note === "") {
    await db.query("DELETE FROM customer_notes WHERE customer_key = ?", [key]);
  } else {
    await db.query(
      `INSERT INTO customer_notes (customer_key, note, updated_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE note = VALUES(note), updated_at = VALUES(updated_at)`,
      [key, note, new Date()],
    );
  }
}
