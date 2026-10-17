import type { RowDataPacket } from "mysql2/promise";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

/**
 * Dnevnik izmena: ko je i kada šta uradio u panelu. Upisuju ga akcije panela pošto izmena
 * uspe; vlasnik ga vidi u Podešavanja → Dnevnik. Samo za server.
 */

export type AuditEntry = { at: string; userName: string; action: string; detail: string };

/** Koliko dana se zapisi čuvaju. */
const KEEP_DAYS = 180;

/** Šta se iz forme uzima kao opis na šta se izmena odnosi (proizvod, porudžbina, kupac…). */
const DETAIL_FIELDS = ["name", "title", "label", "slug", "number", "id", "key", "username", "subject", "src"];

function describe(detail: FormData | string | undefined): string {
  if (detail === undefined) return "";
  if (typeof detail === "string") return detail;
  for (const field of DETAIL_FIELDS) {
    const value = detail.get(field);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * Upisuje izmenu u dnevnik. `detail` je tekst, ili forma iz koje se uzima naziv ili oznaka
 * onoga što se menja. Greška pri upisu dnevnika ne prekida samu izmenu.
 * `as` zadaje korisnika kada još nije prijavljen u ovom zahtevu (sama prijava).
 */
export async function audit(action: string, detail?: FormData | string, as?: { id: number; name: string; username: string }) {
  try {
    const user = as ?? (await getCurrentAdmin());
    await (
      await getDb()
    ).query("INSERT INTO audit_log (at, user_id, user_name, action, detail) VALUES (?, ?, ?, ?, ?)", [
      new Date(),
      user?.id ?? 0,
      user ? user.name || user.username : "nepoznat",
      action.slice(0, 191),
      describe(detail).slice(0, 500),
    ]);
  } catch (error) {
    console.error(`[dnevnik] ${error instanceof Error ? error.message : error}`);
  }
}

/** Poslednji zapisi, najnoviji prvi; stariji od pola godine se brišu. */
/** Jedna strana dnevnika, najnoviji prvi, i koliko zapisa ima ukupno. Stariji od KEEP_DAYS se brišu. */
export async function getAuditLog(page = 1, size = 20): Promise<{ entries: AuditEntry[]; total: number }> {
  const db = await getDb();
  await db.query("DELETE FROM audit_log WHERE at < ?", [new Date(Date.now() - KEEP_DAYS * 86_400_000)]);
  const [count] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM audit_log");
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?", [
    size,
    (Math.max(1, page) - 1) * size,
  ]);
  return {
    entries: rows.map((row) => ({ at: (row.at as Date).toISOString(), userName: row.user_name, action: row.action, detail: row.detail })),
    total: Number(count[0].total),
  };
}
