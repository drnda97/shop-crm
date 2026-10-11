import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { cache } from "react";
import { emptyHighlight, type Category, type Collection, type Page, type Product } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import type { Discount } from "@/lib/discounts";
import { detectImage, makeSizes, type ImageFile } from "@/lib/images";
import { IMAGE_WIDTHS, sizedSrc, VARIANT_FILE } from "@/lib/media";
import { collectImages, normalizeSections, sectionType } from "@/lib/sections";
import { mergeSettings, type Settings } from "@/lib/settings";
import { TEMPLATES } from "@/lib/templates";

/**
 * Sadržaj koji se menja iz admin panela: proizvodi, kategorije, kolekcije,
 * stranice, popusti i podešavanja. Porudžbine su odvojeno, u lib/order-store.ts.
 *
 * Sve je u MySQL bazi (tabele: lib/db.ts). Na disku su samo fajlovi ubačenih
 * slika, u `storage/uploads/`; u bazi je njihova putanja.
 *
 * Samo za server — ne uvoziti u "use client" komponente.
 */

/** Folder sa ubačenim slikama. UPLOADS_DIR ga premešta, npr. na hostingu. */
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), "storage", "uploads");

/** Javna putanja pod kojom app/media/[file]/route.ts služi ubačene slike. */
const MEDIA_PREFIX = "/media/";
export const MEDIA_FILE_PATTERN = /^[a-z0-9-]+\.(jpg|png|webp|svg)$/;

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

type Content = {
  products: Product[];
  categories: Category[];
  collections: Collection[];
  pages: Page[];
  discounts: Discount[];
  settings: Settings;
};

/** Tabele koje zajedno čine sadržaj; `settings` se čuva posebno, kao jedan red. */
const CONTENT_TABLES = [
  "products",
  "product_images",
  "categories",
  "collections",
  "collection_products",
  "pages",
  "discounts",
];

async function loadContent(db: Pool | PoolConnection): Promise<Content> {
  const select = async (sql: string) => (await db.query<RowDataPacket[]>(sql))[0];
  // Jedan po jedan upit: ista veza (u transakciji) ne može da vodi više upita odjednom.
  const products = await select("SELECT * FROM products ORDER BY position");
  const productImages = await select("SELECT * FROM product_images ORDER BY position");
  const categories = await select("SELECT * FROM categories ORDER BY position");
  const collections = await select("SELECT * FROM collections ORDER BY position");
  const collectionProducts = await select("SELECT * FROM collection_products ORDER BY position");
  const pages = await select("SELECT * FROM pages ORDER BY position");
  const discounts = await select("SELECT * FROM discounts ORDER BY position");
  const settings = await select("SELECT value FROM settings WHERE name = 'settings'");
  const saved = settings.length > 0 ? (JSON.parse(settings[0].value) as Partial<Settings>) : {};

  return {
    products: products.map((row) => ({
      slug: row.slug,
      name: row.name,
      sku: row.sku,
      category: row.category,
      active: row.active === 1,
      summary: row.summary,
      description: row.description,
      attributes: JSON.parse(row.attributes),
      price: row.price,
      salePrice: row.sale_price,
      weight: row.weight,
      inStock: row.in_stock === 1,
      stockQty: row.stock_qty,
      lowStockMode: row.low_stock_mode,
      lowStockThreshold: row.low_stock_threshold,
      ...(row.image === null ? {} : { image: row.image }),
      gallery: productImages
        .filter((image) => image.product_slug === row.slug)
        .map((image) => image.src),
      options: JSON.parse(row.options ?? "[]"),
      highlight: { ...emptyHighlight, ...JSON.parse(row.highlight ?? "{}") },
    })),
    categories: categories.map((row) => ({ id: row.id, label: row.label })),
    collections: collections.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      productSlugs: collectionProducts
        .filter((item) => item.collection_id === row.id)
        .map((item) => item.product_slug),
    })),
    pages: pages.map((row) => ({
      slug: row.slug,
      title: row.title,
      sections: normalizeSections(JSON.parse(row.sections ?? "[]")),
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      published: row.published === 1,
      showInFooter: row.show_in_footer === 1,
    })),
    discounts: discounts.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      percent: row.percent,
      status: row.status,
      trigger: row.trigger_type,
      threshold: row.threshold,
      maxUses: row.max_uses,
      expiresAt: row.expires_at,
    })),
    settings: mergeSettings(saved),
  };
}

async function insertRows(connection: PoolConnection, sql: string, rows: unknown[][]) {
  if (rows.length > 0) await connection.query(sql, [rows]);
}

async function storeContent(connection: PoolConnection, content: Content) {
  for (const table of CONTENT_TABLES) await connection.query(`DELETE FROM ${table}`);

  await insertRows(
    connection,
    `INSERT INTO products (slug, position, name, sku, category, active, summary, description,
      attributes, price, sale_price, weight, in_stock, stock_qty, low_stock_mode,
      low_stock_threshold, image, options, highlight) VALUES ?`,
    content.products.map((product, index) => [
      product.slug,
      index,
      product.name,
      product.sku,
      product.category,
      product.active,
      product.summary,
      product.description,
      JSON.stringify(product.attributes),
      product.price,
      product.salePrice,
      product.weight,
      product.inStock,
      product.stockQty,
      product.lowStockMode,
      product.lowStockThreshold,
      product.image ?? null,
      JSON.stringify(product.options),
      JSON.stringify(product.highlight),
    ]),
  );
  await insertRows(
    connection,
    "INSERT INTO product_images (product_slug, position, src) VALUES ?",
    content.products.flatMap((product) =>
      product.gallery.map((src, index) => [product.slug, index, src]),
    ),
  );
  await insertRows(
    connection,
    "INSERT INTO categories (id, position, label) VALUES ?",
    content.categories.map((category, index) => [category.id, index, category.label]),
  );
  await insertRows(
    connection,
    "INSERT INTO collections (id, position, name, description) VALUES ?",
    content.collections.map((item, index) => [item.id, index, item.name, item.description]),
  );
  await insertRows(
    connection,
    "INSERT INTO collection_products (collection_id, product_slug, position) VALUES ?",
    content.collections.flatMap((item) =>
      [...new Set(item.productSlugs)].map((slug, index) => [item.id, slug, index]),
    ),
  );
  // Kolona body je iz prve verzije (tekst bez sekcija); ostaje prazna.
  await insertRows(
    connection,
    `INSERT INTO pages (slug, position, title, body, show_in_footer, sections, seo_title,
      seo_description, published) VALUES ?`,
    content.pages.map((page, index) => [
      page.slug,
      index,
      page.title,
      "",
      page.showInFooter,
      JSON.stringify(page.sections),
      page.seoTitle,
      page.seoDescription,
      page.published,
    ]),
  );
  await insertRows(
    connection,
    `INSERT INTO discounts (id, position, name, code, percent, status, trigger_type, threshold,
      max_uses, expires_at) VALUES ?`,
    content.discounts.map((discount, index) => [
      discount.id,
      index,
      discount.name,
      discount.code,
      discount.percent,
      discount.status,
      discount.trigger,
      discount.threshold,
      discount.maxUses,
      discount.expiresAt,
    ]),
  );
  await connection.query(
    "INSERT INTO settings (name, value) VALUES ('settings', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [JSON.stringify(content.settings)],
  );
}

const readContent = cache(async () => loadContent(await getDb()));

// GET_LOCK važi za ceo MySQL server, pa ime sadrži i bazu: više prodavnica na
// istom serveru se međusobno ne čekaju. Ime zaključavanja može imati najviše 64 znaka.
const LOCK_NAME = `shopcrm:${process.env.DB_NAME ?? ""}`.slice(0, 64);

/**
 * Izvršava `run` u transakciji, pod zaključavanjem po imenu: izmene sadržaja i
 * upisi porudžbina (koji skidaju sa stanja) idu jedna po jedna, i kada panel
 * radi u više procesa. Sve se sačuva celo ili nikako.
 */
export async function withContentLock<T>(
  run: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await (await getDb()).getConnection();
  try {
    const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 10) AS locked", [
      LOCK_NAME,
    ]);
    if (lock[0].locked !== 1) throw new Error("Druga izmena je u toku. Pokušajte ponovo.");
    try {
      await connection.beginTransaction();
      const result = await run(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]);
    }
  } finally {
    connection.release();
  }
}

/**
 * Jedini put za izmene sadržaja iz panela: učita ga iz baze, primeni `change`
 * i upiše nazad. Tabele sadržaja se prepisuju cele — jednostavno i dovoljno brzo
 * za kataloge do nekoliko stotina proizvoda.
 */
export async function updateContent(change: (content: Content) => void): Promise<void> {
  await withContentLock(async (connection) => {
    const content = await loadContent(connection);
    change(content);
    await storeContent(connection, content);
  });
}

/** Pojedinačan zapis iz tabele settings (npr. sopstveni šablon emaila); null ako ga nema. */
export async function getStoredValue(name: string): Promise<string | null> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT value FROM settings WHERE name = ?", [name]);
  return rows.length > 0 ? rows[0].value : null;
}

/** Upisuje zapis u tabelu settings; `null` ga briše. */
export async function setStoredValue(name: string, value: string | null) {
  const db = await getDb();
  if (value === null) {
    await db.query("DELETE FROM settings WHERE name = ?", [name]);
  } else {
    await db.query(
      "INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
      [name, value],
    );
  }
}

/** Svi proizvodi, i nacrti — za panel. API prikazuje samo objavljene. */
export async function getProducts(): Promise<Product[]> {
  return (await readContent()).products;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return (await getProducts()).find((product) => product.slug === slug);
}

export async function getCategories(): Promise<Category[]> {
  return (await readContent()).categories;
}

export async function getCollections(): Promise<Collection[]> {
  return (await readContent()).collections;
}

export async function getPages(): Promise<Page[]> {
  return (await readContent()).pages;
}

/** Sadrži i lozinku za SMTP — ne prosleđivati ceo objekat u "use client" komponente ni u API. */
export async function getSettings(): Promise<Settings> {
  return (await readContent()).settings;
}

export async function getDiscounts(): Promise<Discount[]> {
  return (await readContent()).discounts;
}

export type UploadResult = { ok: true; src: string } | { ok: false; error: string };

type UploadOptions = {
  /**
   * Čuva fajl kakav jeste, bez pretvaranja u WebP. Za logo i favicon: logo ide i u email,
   * a neki programi za poštu ne prikazuju WebP.
   */
  original?: boolean;
};

/**
 * Čuva ubačenu sliku u storage/uploads i vraća njenu javnu putanju. Fotografija se pretvara
 * u WebP u više širina (lib/images.ts); SVG se čuva kakav jeste.
 * Svaka slika dobija novo ime, pa pregledač nikad ne prikaže staru iz keša.
 */
export async function saveUpload(
  file: File,
  name: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: "Slika je veća od 15 MB. Smanjite je pa pokušajte ponovo.",
    };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = detectImage(bytes);
  if (!kind) {
    return { ok: false, error: "Slika mora biti JPG, PNG, WebP ili SVG." };
  }

  // Vreme i nasumičan dodatak: više slika ubačenih u istom trenutku ne dobija isto ime.
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const base = `${name}-${unique}`;
  let files: ImageFile[];
  if (kind === "svg" || options.original) {
    files = [{ name: `${base}.${kind}`, data: bytes }];
  } else {
    try {
      files = await makeSizes(bytes, base);
    } catch {
      return { ok: false, error: "Slika je oštećena ili nije u ispravnom formatu." };
    }
  }

  await mkdir(UPLOADS_DIR, { recursive: true });
  for (const item of files) await writeFile(path.join(UPLOADS_DIR, item.name), item.data);
  return { ok: true, src: `${MEDIA_PREFIX}${files[0].name}` };
}

/** Putanja na disku do ubačene slike, ili null ako `src` nije iz storage/uploads. */
export function uploadPath(src: string | undefined): string | null {
  if (!src?.startsWith(MEDIA_PREFIX)) return null;
  const fileName = src.slice(MEDIA_PREFIX.length);
  return MEDIA_FILE_PATTERN.test(fileName) ? path.join(UPLOADS_DIR, fileName) : null;
}

/**
 * Briše ubačenu sliku, osim ako je sadržaj još koristi: ista slika iz biblioteke može
 * biti i na proizvodu i u sekciji stranice. Poziva se posle izmene sadržaja, pa se
 * upotreba čita iz baze iznova, ne iz keša zahteva.
 */
export async function removeUpload(src: string | undefined) {
  const file = uploadPath(src);
  if (!file || !src) return;
  if (usedImages(await loadContent(await getDb())).has(src)) return;
  await unlink(file).catch(() => {});
  // Manje veličine iste slike.
  for (const width of IMAGE_WIDTHS) {
    const sized = uploadPath(sizedSrc(src, width));
    if (sized && sized !== file) await unlink(sized).catch(() => {});
  }
}

export type MediaFile = { src: string; bytes: number; addedAt: number };

/** Sve ubačene slike (biblioteka slika u panelu), najnovije prve. */
export async function listUploads(): Promise<MediaFile[]> {
  const names = await readdir(UPLOADS_DIR).catch(() => [] as string[]);
  const files = await Promise.all(
    names
      // Manje veličine nisu posebne slike u biblioteci.
      .filter((name) => MEDIA_FILE_PATTERN.test(name) && !VARIANT_FILE.test(name))
      .map(async (name) => {
        const info = await stat(path.join(UPLOADS_DIR, name));
        return { src: `${MEDIA_PREFIX}${name}`, bytes: info.size, addedAt: info.mtimeMs };
      }),
  );
  return files.sort((a, b) => b.addedAt - a.addedAt);
}

function usedImages({ products, pages, settings }: Content): Set<string> {
  const used = new Set<string>();
  for (const product of products) {
    if (product.image) used.add(product.image);
    if (product.highlight.image) used.add(product.highlight.image);
    for (const src of product.gallery) used.add(src);
  }
  for (const item of TEMPLATES) {
    for (const image of collectImages(item.fields, settings.templates[item.id])) used.add(image.src);
  }
  for (const page of pages) {
    for (const section of page.sections) {
      const fields = sectionType(section.type)?.fields ?? [];
      for (const image of collectImages(fields, section.data)) used.add(image.src);
    }
  }
  if (settings.logo) used.add(settings.logo);
  if (settings.favicon) used.add(settings.favicon);
  return used;
}

/** Putanje slika koje sadržaj trenutno koristi: proizvodi, stranice, logo i favicon. */
export async function getUsedImages(): Promise<Set<string>> {
  return usedImages(await readContent());
}
