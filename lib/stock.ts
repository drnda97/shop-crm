import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Product } from "@/lib/catalog";
import { getDb } from "@/lib/db";

/**
 * Istorija promena stanja: svaka promena broja komada (porudžbina, otkazivanje, izmena u
 * panelu, uvoz) ostavlja red u tabeli stock_log. Samo za server.
 */

export type StockChange = {
  slug: string;
  /** Id varijante, ili prazno kada se stanje vodi uz proizvod. */
  variantId: string;
  /** Koliko je komada dodato (+) ili skinuto (−). */
  change: number;
  /** Stanje posle promene; null kada nije poznato. */
  qtyAfter: number | null;
  reason: string;
};

export type StockEntry = Omit<StockChange, "slug"> & { at: string };

export async function logStock(connection: PoolConnection, changes: StockChange[]) {
  if (changes.length === 0) return;
  const now = new Date();
  await connection.query(
    "INSERT INTO stock_log (at, product_slug, variant_id, change_qty, qty_after, reason) VALUES ?",
    [changes.map((item) => [now, item.slug, item.variantId, item.change, item.qtyAfter, item.reason])],
  );
}

/** Poslednje promene stanja proizvoda, najnovije prve. */
export async function getStockLog(slug: string, limit = 40): Promise<StockEntry[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>(
    "SELECT * FROM stock_log WHERE product_slug = ? ORDER BY id DESC LIMIT ?",
    [slug, limit],
  );
  return rows.map((row) => ({
    at: (row.at as Date).toISOString(),
    variantId: row.variant_id,
    change: row.change_qty,
    qtyAfter: row.qty_after,
    reason: row.reason,
  }));
}

/** Broj komada svega čemu se vodi stanje: „slug|varijanta" → broj. */
function tracked(products: Product[]): Map<string, number> {
  const stock = new Map<string, number>();
  for (const product of products) {
    if (product.variants.length === 0) {
      if (product.stockQty !== null) stock.set(`${product.slug}|`, product.stockQty);
    } else {
      for (const variant of product.variants) {
        if (variant.stockQty !== null) stock.set(`${product.slug}|${variant.id}`, variant.stockQty);
      }
    }
  }
  return stock;
}

/**
 * Šta se promenilo u stanju između dva stanja kataloga (pre i posle izmene u panelu):
 * novi broj komada, i broj koji je tek počeo da se vodi. Prestanak vođenja se ne beleži.
 */
export function stockDiff(before: Product[], after: Product[], reason: string): StockChange[] {
  const old = tracked(before);
  return [...tracked(after)].flatMap(([key, qty]) => {
    const previous = old.get(key);
    if (previous === qty) return [];
    const [slug, variantId] = key.split("|");
    return [
      previous === undefined
        ? { slug, variantId, change: qty, qtyAfter: qty, reason: `${reason} (početno stanje)` }
        : { slug, variantId, change: qty - previous, qtyAfter: qty, reason },
    ];
  });
}
