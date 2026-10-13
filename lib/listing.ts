import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { categoryPath, isAvailable, priceRange, type Category, type Product } from "@/lib/catalog";
import { getDb } from "@/lib/db";

/**
 * Spisak proizvoda za prodavnicu u tabelama po kojima baza sama filtrira: stranica kolekcije,
 * pretraga, slični proizvodi i sekcije traže upitom samo proizvode koje prikazuju, umesto da
 * se učita ceo katalog. Tabele se pišu pri svakoj izmeni sadržaja (storeContent u lib/content.ts),
 * istim pravilima kao ostatak prodavnice: u spisku je samo proizvod koji može da se poruči,
 * sa cenom koju kupac plaća. Samo za server.
 */

/** Menja se kada se promeni šta se upisuje u spisak, pa se on pri sledećem čitanju napravi iznova. */
const LISTING_VERSION = "1";

export type ListingSort = "rec" | "asc" | "desc" | "az";

export type ListingFilter = {
  /** Kategorija (id); proizvod iz podkategorije se vidi i u nadkategoriji. */
  category?: string;
  /** Kolekcija (id). */
  collection?: string;
  /** Sve reči moraju da se nađu u nazivu, kategoriji ili opisu. */
  search?: string;
  /** Cena u najmanjim jedinicama (kako je u bazi). */
  min?: number | null;
  max?: number | null;
  /** Izabrane vrednosti po opciji: proizvod prolazi ako za svaku opciju ima bar jednu od izabranih. */
  options?: Record<string, string[]>;
  /** Samo proizvodi bez varijanti (dodaju se u korpu jednim klikom). */
  simple?: boolean;
  /** Proizvodi koji se preskaču (slug). */
  exclude?: string[];
  sort?: ListingSort;
};

async function insertRows(connection: PoolConnection, sql: string, rows: unknown[][]) {
  // U delovima, da jedan upit ne preraste ograničenje veličine paketa kod velikog kataloga.
  for (let at = 0; at < rows.length; at += 500) await connection.query(sql, [rows.slice(at, at + 500)]);
}

/** Pravi spisak iz kataloga koji se upravo upisuje. Poziva se u istoj transakciji kao i upis sadržaja. */
export async function storeListing(connection: PoolConnection, products: Product[], categories: Category[]) {
  for (const table of ["product_listing", "product_listing_categories", "product_listing_options"]) await connection.query(`DELETE FROM ${table}`);
  const listed = products.map((product, position) => ({ product, position })).filter(({ product }) => isAvailable(product));
  const label = (id: string) => categories.find((category) => category.id === id)?.label ?? "";

  await insertRows(
    connection,
    "INSERT INTO product_listing (slug, position, name, price, simple, search) VALUES ?",
    listed.map(({ product, position }) => [
      product.slug,
      position,
      product.name,
      priceRange(product).from ?? 0,
      product.variants.length === 0,
      `${product.name} ${label(product.categories[0] ?? "")} ${product.summary} ${product.description}`.slice(0, 60_000),
    ]),
  );
  await insertRows(
    connection,
    "INSERT INTO product_listing_categories (category_id, slug) VALUES ?",
    listed.flatMap(({ product }) =>
      [...new Set(product.categories.flatMap((id) => categoryPath(categories, id).map((category) => category.id)))].map((id) => [id, product.slug]),
    ),
  );
  let position = 0;
  await insertRows(
    connection,
    "INSERT INTO product_listing_options (slug, name, value, position) VALUES ?",
    listed.flatMap(({ product }) =>
      product.options.flatMap((option) =>
        [...new Set(option.values.map((value) => value.label))].map((value) => [product.slug, option.name.slice(0, 191), value.slice(0, 191), position++]),
      ),
    ),
  );
  await connection.query("INSERT INTO settings (name, value) VALUES ('listing', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [LISTING_VERSION]);
}

let ready = false;

/** Baza napravljena pre ovih tabela ima prazan spisak: prvi upit ga napravi iz postojećeg kataloga. */
async function ensureListing(db: Pool) {
  if (ready) return;
  const [rows] = await db.query<RowDataPacket[]>("SELECT value FROM settings WHERE name = 'listing'");
  if (rows[0]?.value !== LISTING_VERSION) {
    // Upis sadržaja bez izmene prepisuje i spisak. Uvoz je ovde da moduli ne zavise ukrug.
    const { updateContent } = await import("@/lib/content");
    await updateContent(() => {});
  }
  ready = true;
}

const like = (word: string) => `%${word.replace(/[\\%_]/g, "\\$&")}%`;

function where(filter: ListingFilter): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (filter.category) {
    parts.push("EXISTS (SELECT 1 FROM product_listing_categories c WHERE c.category_id = ? AND c.slug = l.slug)");
    params.push(filter.category);
  }
  if (filter.collection) {
    parts.push("EXISTS (SELECT 1 FROM collection_products cp WHERE cp.collection_id = ? AND cp.product_slug = l.slug)");
    params.push(filter.collection);
  }
  if (filter.min !== null && filter.min !== undefined) {
    parts.push("l.price >= ?");
    params.push(Math.round(filter.min));
  }
  if (filter.max !== null && filter.max !== undefined) {
    parts.push("l.price <= ?");
    params.push(Math.round(filter.max));
  }
  for (const [name, values] of Object.entries(filter.options ?? {})) {
    if (values.length === 0) continue;
    parts.push("EXISTS (SELECT 1 FROM product_listing_options o WHERE o.slug = l.slug AND o.name = ? AND o.value IN (?))");
    params.push(name, values);
  }
  for (const word of (filter.search ?? "").split(/\s+/).filter(Boolean).slice(0, 8)) {
    parts.push("l.search LIKE ?");
    params.push(like(word));
  }
  if (filter.simple) parts.push("l.simple = 1");
  if (filter.exclude && filter.exclude.length > 0) {
    parts.push("l.slug NOT IN (?)");
    params.push(filter.exclude);
  }
  return { sql: parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "", params };
}

const ORDER: Record<ListingSort, string> = {
  rec: "l.position",
  asc: "l.price, l.position",
  desc: "l.price DESC, l.position",
  az: "l.name, l.position",
};

/** Proizvodi (slug) koji prolaze filter, traženim redom, i koliko ih ukupno ima. */
export async function listSlugs(filter: ListingFilter, limit: number, offset = 0): Promise<{ slugs: string[]; total: number }> {
  const db = await getDb();
  await ensureListing(db);
  const { sql, params } = where(filter);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT l.slug FROM product_listing l ${sql} ORDER BY ${ORDER[filter.sort ?? "rec"]} LIMIT ? OFFSET ?`,
    [...params, Math.max(0, Math.trunc(limit)), Math.max(0, Math.trunc(offset))],
  );
  const [count] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM product_listing l ${sql}`, params);
  return { slugs: rows.map((row) => String(row.slug)), total: Number(count[0].total) };
}

/** Opcije i njihove vrednosti među proizvodima kategorije (ili svim), za filtere. */
export async function listFacets(category: string): Promise<{ name: string; values: string[] }[]> {
  const db = await getDb();
  await ensureListing(db);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT o.name, o.value, MIN(o.position) AS first FROM product_listing_options o
     ${category ? "JOIN product_listing_categories c ON c.slug = o.slug AND c.category_id = ?" : ""}
     GROUP BY o.name, o.value ORDER BY first`,
    category ? [category] : [],
  );
  const facets = new Map<string, string[]>();
  for (const row of rows) facets.set(row.name, [...(facets.get(row.name) ?? []), row.value]);
  return [...facets].map(([name, values]) => ({ name, values }));
}
