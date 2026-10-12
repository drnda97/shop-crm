import { createHash, createHmac, randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { after } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Veza sa spoljnim sistemima (knjigovodstvo, magacin, kurirska služba…): API ključevi za
 * /api/v1/admin i webhook-ovi koji javljaju šta se desilo sa porudžbinom. Samo za server.
 */

/* ---------- API ključevi ---------- */

export type ApiScope = "read" | "write";

export const scopeLabels: Record<ApiScope, string> = {
  read: "Samo čitanje",
  write: "Čitanje i izmene",
};

export type ApiKey = {
  id: number;
  name: string;
  /** Početak ključa, da se u spisku prepozna koji je koji. */
  prefix: string;
  scope: ApiScope;
  createdAt: string;
  lastUsedAt: string | null;
};

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

function toKey(row: RowDataPacket): ApiKey {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scope: row.scope === "write" ? "write" : "read",
    createdAt: (row.created_at as Date).toISOString(),
    lastUsedAt: row.last_used_at ? (row.last_used_at as Date).toISOString() : null,
  };
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT * FROM api_keys ORDER BY id");
  return rows.map(toKey);
}

/** Pravi ključ i vraća ga; u bazi ostaje samo heš, pa se ceo ključ vidi samo sada. */
export async function createApiKey(name: string, scope: ApiScope): Promise<string> {
  const key = `sk_${randomBytes(24).toString("hex")}`;
  await (
    await getDb()
  ).query("INSERT INTO api_keys (name, key_hash, prefix, scope, created_at) VALUES (?, ?, ?, ?, ?)", [
    name,
    hashKey(key),
    key.slice(0, 9),
    scope,
    new Date(),
  ]);
  return key;
}

export async function deleteApiKey(id: number) {
  await (await getDb()).query("DELETE FROM api_keys WHERE id = ?", [id]);
}

/** Ključ iz zaglavlja `Authorization: Bearer sk_…`; null kada ga nema ili ne važi. */
export async function checkApiKey(request: Request): Promise<ApiKey | null> {
  const match = /^Bearer\s+(sk_[0-9a-f]{48})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return null;
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM api_keys WHERE key_hash = ?", [hashKey(match[1])]);
  if (rows.length === 0) return null;
  await db.query("UPDATE api_keys SET last_used_at = ? WHERE id = ?", [new Date(), rows[0].id]);
  return toKey(rows[0]);
}

/* ---------- Webhook-ovi ---------- */

export const webhookEvents = {
  "order.created": "Nova porudžbina",
  "order.status": "Promenjen status porudžbine",
  "order.paid": "Porudžbina plaćena",
  "order.refunded": "Povraćaj novca",
} as const;

export type WebhookEvent = keyof typeof webhookEvents;

export type Webhook = {
  id: number;
  url: string;
  /** Ovim se potpisuje svaka poruka; primalac istim proverava da je stigla odavde. */
  secret: string;
  events: WebhookEvent[];
  active: boolean;
  lastAt: string | null;
  /** HTTP status poslednje isporuke; 0 kada adresa nije odgovorila. */
  lastStatus: number | null;
  lastError: string | null;
};

function toWebhook(row: RowDataPacket): Webhook {
  return {
    id: row.id,
    url: row.url,
    secret: row.secret,
    events: String(row.events).split(",").filter((event): event is WebhookEvent => event in webhookEvents),
    active: row.active === 1,
    lastAt: row.last_at ? (row.last_at as Date).toISOString() : null,
    lastStatus: row.last_status,
    lastError: row.last_error,
  };
}

export async function listWebhooks(): Promise<Webhook[]> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT * FROM webhooks ORDER BY id");
  return rows.map(toWebhook);
}

export function isWebhookUrl(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol) && url.length <= 500;
  } catch {
    return false;
  }
}

export async function createWebhook(url: string, events: WebhookEvent[]): Promise<number> {
  const [result] = await (
    await getDb()
  ).query<ResultSetHeader>("INSERT INTO webhooks (url, secret, events, created_at) VALUES (?, ?, ?, ?)", [
    url,
    randomBytes(24).toString("hex"),
    events.join(","),
    new Date(),
  ]);
  return result.insertId;
}

export async function setWebhookActive(id: number, active: boolean) {
  await (await getDb()).query("UPDATE webhooks SET active = ? WHERE id = ?", [active, id]);
}

export async function deleteWebhook(id: number) {
  await (await getDb()).query("DELETE FROM webhooks WHERE id = ?", [id]);
}

/** Potpis poruke: HMAC-SHA256 tela tajnom webhook-a, u zaglavlju X-ShopCRM-Signature kao `sha256=…`. */
export function signWebhook(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

const TIMEOUT_MS = 8000;
/** Pauze pre ponovnih pokušaja kada adresa ne odgovori ili vrati grešku. */
const RETRY_AFTER_MS = [2000, 10000];

type Delivery = { status: number; error: string | null };

async function post(webhook: Webhook, event: string, body: string): Promise<Delivery> {
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ShopCRM-Webhook",
        "X-ShopCRM-Event": event,
        "X-ShopCRM-Signature": signWebhook(webhook.secret, body),
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { status: response.status, error: response.ok ? null : `Adresa je odgovorila sa ${response.status}` };
  } catch (error) {
    return { status: 0, error: (error instanceof Error ? error.message : String(error)).slice(0, 255) };
  }
}

/** Šalje poruku na jedan webhook, uz ponovne pokušaje, i upisuje ishod poslednjeg. */
export async function deliverWebhook(webhook: Webhook, event: string, data: unknown, retries = RETRY_AFTER_MS): Promise<Delivery> {
  const body = JSON.stringify({ event, at: new Date().toISOString(), data });
  let outcome = await post(webhook, event, body);
  for (const wait of retries) {
    if (outcome.error === null) break;
    await new Promise((resolve) => setTimeout(resolve, wait));
    outcome = await post(webhook, event, body);
  }
  await (
    await getDb()
  ).query("UPDATE webhooks SET last_at = ?, last_status = ?, last_error = ? WHERE id = ?", [
    new Date(),
    outcome.status,
    outcome.error,
    webhook.id,
  ]);
  return outcome;
}

/**
 * Javlja spoljnim sistemima šta se desilo sa porudžbinom. Šalje se pošto zahtev dobije
 * odgovor, pa spora ili ugašena adresa ne usporava ni kupca ni panel.
 */
export function emitOrderEvent(event: WebhookEvent, number: string | number, extra: Record<string, unknown> = {}) {
  const run = async () => {
    try {
      const hooks = (await listWebhooks()).filter((hook) => hook.active && hook.events.includes(event));
      if (hooks.length === 0) return;
      const { getOrder } = await import("@/lib/order-store");
      const order = await getOrder(String(number));
      if (!order) return;
      const data = { order: apiOrder(order), ...extra };
      await Promise.all(hooks.map((hook) => deliverWebhook(hook, event, data)));
    } catch (error) {
      console.error(`[webhook ${event}] ${error instanceof Error ? error.message : error}`);
    }
  };
  try {
    after(run);
  } catch {
    // Van zahteva (raspored, skripta) nema `after`.
    void run();
  }
}

/** Porudžbina kako je vide spoljni sistemi: bez interne beleške i podataka o slanju emaila. */
export function apiOrder(order: import("@/lib/orders").Order) {
  const { adminNote, emailError, customerKey, ...rest } = order;
  void adminNote;
  void emailError;
  void customerKey;
  return rest;
}
