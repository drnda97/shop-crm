import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { cache } from "react";
import { getDb } from "@/lib/db";
import type { Dict, Lang } from "@/lib/i18n";

/**
 * Prevodi koje vlasnik upisuje u panelu (Prevodi), po jeziku: izvorni tekst → prevod. Izvor je
 * tekst kakav je u prodavnici na glavnom jeziku (naziv proizvoda, stavka menija, pasus stranice)
 * ili srpski tekst iz koda teme („Dodaj u korpu"). Imaju prednost nad rečnicima iz koda.
 * Samo za server.
 */

const hash = (source: string) => createHash("sha1").update(source).digest("hex");

/** Svi upisani prevodi jednog jezika. */
export const getTranslations = cache(async (lang: Lang): Promise<Dict> => {
  try {
    const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT source, value FROM translations WHERE lang = ?", [lang]);
    return Object.fromEntries(rows.map((row) => [row.source as string, row.value as string]));
  } catch {
    // Tabela nastaje migracijom; do tada prevoda nema.
    return {};
  }
});

/** Upisuje prevode; prazan prevod briše upisani, pa opet važi rečnik iz koda ili izvorni tekst. */
export async function saveTranslations(lang: Lang, entries: { source: string; value: string }[]) {
  const db = await getDb();
  for (const { source, value } of entries) {
    if (!source) continue;
    if (value.trim() === "") {
      await db.query("DELETE FROM translations WHERE lang = ? AND source_hash = ?", [lang, hash(source)]);
    } else {
      await db.query(
        "INSERT INTO translations (lang, source_hash, source, value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
        [lang, hash(source), source, value],
      );
    }
  }
}

/** Koliko je prevoda upisano po jeziku. */
export async function countTranslations(): Promise<Record<string, number>> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT lang, COUNT(*) AS total FROM translations GROUP BY lang");
  return Object.fromEntries(rows.map((row) => [row.lang as string, Number(row.total)]));
}
