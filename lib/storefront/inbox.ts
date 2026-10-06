import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";

/** Poruke iz kontakt forme prodavnice i prijave na novosti. Samo za server. */

export type ShopMessage = {
  id: number;
  createdAt: string;
  name: string;
  email: string;
  topic: string;
  body: string;
};

export type Subscriber = { email: string; createdAt: string };

export async function addMessage(message: Omit<ShopMessage, "id" | "createdAt">) {
  await (
    await getDb()
  ).query("INSERT INTO shop_messages (created_at, name, email, topic, body) VALUES (?, ?, ?, ?, ?)", [
    new Date(),
    message.name,
    message.email,
    message.topic,
    message.body,
  ]);
}

/** Najnovija prva. */
export async function getMessages(): Promise<ShopMessage[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT * FROM shop_messages ORDER BY id DESC");
  return rows.map((row) => ({
    id: row.id,
    createdAt: (row.created_at as Date).toISOString(),
    name: row.name,
    email: row.email,
    topic: row.topic,
    body: row.body,
  }));
}

export async function deleteMessage(id: number) {
  await (await getDb()).query("DELETE FROM shop_messages WHERE id = ?", [id]);
}

/** Ista adresa se upisuje jednom. */
export async function addSubscriber(email: string) {
  await (
    await getDb()
  ).query("INSERT IGNORE INTO shop_subscribers (email, created_at) VALUES (?, ?)", [email, new Date()]);
}

export async function getSubscribers(): Promise<Subscriber[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT * FROM shop_subscribers ORDER BY created_at DESC");
  return rows.map((row) => ({ email: row.email, createdAt: (row.created_at as Date).toISOString() }));
}
