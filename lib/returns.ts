import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";

/**
 * Zahtevi za povrat: kupac sa stranice za praćenje porudžbine bira šta vraća i zašto, a
 * prodavac u panelu odobrava ili odbija. Odobren zahtev ne vraća novac sam: povraćaj se
 * upisuje na stranici porudžbine, kada roba stigne. Samo za server.
 */

export type ReturnStatus = "new" | "approved" | "rejected";

export const returnStatusLabels: Record<ReturnStatus, string> = {
  new: "čeka odgovor",
  approved: "odobren",
  rejected: "odbijen",
};

export type ReturnRequest = {
  id: number;
  orderNumber: string;
  createdAt: string;
  /** Šta kupac vraća: naziv stavke i broj komada, kako su bili u porudžbini. */
  items: { name: string; qty: number }[];
  reason: string;
  status: ReturnStatus;
  /** Odgovor prodavca, koji kupac vidi. */
  answer: string;
};

function toRequest(row: RowDataPacket): ReturnRequest {
  return {
    id: row.id,
    orderNumber: String(row.order_number),
    createdAt: (row.created_at as Date).toISOString(),
    items: JSON.parse(row.items),
    reason: row.reason,
    status: row.status,
    answer: row.answer ?? "",
  };
}

export async function addReturnRequest(orderNumber: string, items: { name: string; qty: number }[], reason: string): Promise<number> {
  const [result] = await (
    await getDb()
  ).query<ResultSetHeader>(
    "INSERT INTO return_requests (order_number, created_at, items, reason) VALUES (?, ?, ?, ?)",
    [orderNumber, new Date(), JSON.stringify(items), reason],
  );
  return result.insertId;
}

/** Zahtevi jedne porudžbine, najnoviji prvi. */
export async function getOrderReturns(orderNumber: string): Promise<ReturnRequest[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT * FROM return_requests WHERE order_number = ? ORDER BY id DESC", [orderNumber]);
  return rows.map(toRequest);
}

/** Zahtevi koji čekaju odgovor, najstariji prvi. */
export async function getOpenReturns(): Promise<ReturnRequest[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT * FROM return_requests WHERE status = 'new' ORDER BY id");
  return rows.map(toRequest);
}

/** Odgovor prodavca. Vraća zahtev, ili null ako je već rešen ili ne postoji. */
export async function resolveReturn(id: number, status: "approved" | "rejected", answer: string): Promise<ReturnRequest | null> {
  const db = await getDb();
  const [changed] = await db.query<ResultSetHeader>(
    "UPDATE return_requests SET status = ?, answer = ?, resolved_at = ? WHERE id = ? AND status = 'new'",
    [status, answer, new Date(), id],
  );
  if (changed.affectedRows === 0) return null;
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM return_requests WHERE id = ?", [id]);
  return rows.length > 0 ? toRequest(rows[0]) : null;
}
