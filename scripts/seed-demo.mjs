// Demo sadržaj za javnu prodavnicu: proizvodi iz dizajna, kategorije, kolekcije
// (oznake „Novo" i „Bestseler"), promo kod dobrodošlice i podešavanja dostave i plaćanja.
//
//   npm run seed:demo
//
// Dodaje samo ono čega nema: postojeći proizvodi, kolekcije, popusti i podešavanja se ne
// menjaju, pa je bezbedno pokrenuti je više puta. Podatke za bazu čita iz .env.local.
// Tabele pravi sama aplikacija pri prvom pokretanju (npm run dev), pa nju pokrenite pre skripte.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, UPLOADS_DIR } = process.env;
if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error("Baza nije podešena: upišite DB_HOST, DB_USER, DB_PASSWORD i DB_NAME u .env.local.");
  process.exit(1);
}

const categories = [
  { id: "fotelje", label: "Fotelje" },
  { id: "stolice", label: "Stolice" },
  { id: "barske", label: "Barske" },
];

// Kratak opis (summary) je podrazumevana varijanta: nju prodavnica upisuje u korpu sa kartice.
const products = [
  { slug: "fotelja-vera", name: "Fotelja Vera", category: "fotelje", summary: "Breskva, somot", price: 48900, image: "ds-p-wing.jpg" },
  { slug: "stolica-oliva", name: "Stolica Oliva", category: "stolice", summary: "Maslina, hrastove noge", price: 18400, image: "ds-p-olive.jpg" },
  {
    slug: "okretna-fotelja-mio",
    name: "Okretna fotelja Mio",
    category: "fotelje",
    summary: "Pesak, hrast",
    price: 39900,
    image: "ds-p-swivel.jpg",
    gallery: ["ds-armchair-plant.jpg", "ds-detail-b.jpg", "ds-living-window.jpg"],
    description:
      "Niska fotelja koja se okreće za 360°, sa sedištem od hladno livene pene i postoljem od masivnog hrasta. Dovoljno mala za ugao, dovoljno udobna za celo veče.",
    attributes: [
      { title: "Opis", text: "Sedište je oblikovano od hladno livene pene preko čeličnog rama, pa zadržava formu godinama. Okretni mehanizam je skriven u postolju i radi bez zvuka." },
      { title: "Materijali i održavanje", text: "Tkanina: 62% vuna, 38% lan. Postolje: masivni hrast, uljen. Navlaka se skida i pere na 30°C. Drvo brisati suvom krpom i jednom godišnje premazati uljem." },
      { title: "Dostava i povrat", text: "Isporuka za 5 do 10 radnih dana, sa unošenjem i montažom. Dostava je besplatna za porudžbine preko 50.000 RSD, a proizvod možete vratiti u roku od 30 dana." },
    ],
  },
  { slug: "barska-stolica-nord", name: "Barska stolica Nord", category: "barske", summary: "Crna, bukva", price: 12900, image: "ds-p-black.jpg" },
  { slug: "stolica-lena", name: "Stolica Lena", category: "stolice", summary: "Siva, bukva", price: 16500, image: "ds-p-grey.jpg" },
  { slug: "fotelja-skoljka", name: "Fotelja Školjka", category: "fotelje", summary: "Breskva, čelik", price: 54000, image: "ds-p-peach.jpg" },
  { slug: "hoklica-hrast", name: "Hoklica Hrast", category: "barske", summary: "Masivni hrast, 65 cm", price: 6400, image: "ds-p-stool.jpg" },
  { slug: "stolica-kreda", name: "Stolica Kreda", category: "stolice", summary: "Bela, mat", price: 7900, salePrice: 6700, image: "ds-p-white.jpg" },
  { slug: "fotelja-bela", name: "Fotelja Bela", category: "fotelje", summary: "Slonovača, kapitonirana", price: 27500, image: "ds-p-tufted.jpg" },
  { slug: "fotelja-atlas", name: "Fotelja Atlas", category: "fotelje", summary: "Plava, orah", price: 34900, image: "ds-p-blue.jpg" },
  { slug: "par-fotelja-oblak", name: "Par fotelja Oblak", category: "fotelje", summary: "Bukle, slonovača", price: 89000, image: "ds-p-pair.jpg" },
];

// Naziv kolekcije je oznaka na kartici proizvoda (lib/storefront/catalog.ts).
const collections = [
  { id: "bestseler", name: "Bestseler", slugs: ["okretna-fotelja-mio"] },
  { id: "novo", name: "Novo", slugs: ["fotelja-vera", "par-fotelja-oblak"] },
];

const discount = { id: "dobrodoslica", name: "Dobrodošlica", code: "DOBRODOSLI10", percent: 10 };

// Ostala podešavanja dobijaju početne vrednosti iz lib/settings.ts. Email (SMTP) ostaje prazan,
// pa se poruke o porudžbini ne šalju dok se ne upiše u panelu.
const settings = {
  store: { name: "Demo Shop" },
  shipping: { price: 1200, freeEnabled: true, freeFrom: 50000, pickupEnabled: true },
  payment: {
    cod: true,
    bank: true,
    bankInstructions: "Primalac: [NAZIV FIRME]\nRačun: [BROJ RAČUNA]\nPoziv na broj: broj porudžbine",
  },
};

// Slike idu tamo gde ih čuva i panel (storage/uploads), pa se vide i menjaju iz njega.
const sourceDir = path.join(process.cwd(), "public", "shop");
const uploadsDir = UPLOADS_DIR ?? path.join(process.cwd(), "storage", "uploads");
mkdirSync(uploadsDir, { recursive: true });

function media(file) {
  const target = path.join(uploadsDir, file);
  if (!existsSync(target)) copyFileSync(path.join(sourceDir, file), target);
  return `/media/${file}`;
}

const db = await mysql.createConnection({
  host: DB_HOST,
  port: DB_PORT ? Number(DB_PORT) : 3306,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  charset: "utf8mb4",
});

const [tables] = await db.query("SHOW TABLES LIKE 'products'");
if (tables.length === 0) {
  console.error("Tabele još ne postoje. Pokrenite aplikaciju jednom (npm run dev, pa otvorite /admin) i ponovite.");
  await db.end();
  process.exit(1);
}

async function nextPosition(table) {
  const [rows] = await db.query(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM ${table}`);
  return rows[0].next;
}

const added = { kategorije: 0, proizvodi: 0, kolekcije: 0, popusti: 0, podešavanja: 0 };

await db.beginTransaction();
try {
  let position = await nextPosition("categories");
  for (const category of categories) {
    const [result] = await db.query("INSERT IGNORE INTO categories (id, position, label) VALUES (?, ?, ?)", [
      category.id,
      position,
      category.label,
    ]);
    if (result.affectedRows > 0) {
      position++;
      added.kategorije++;
    }
  }

  position = await nextPosition("products");
  for (const product of products) {
    const [existing] = await db.query("SELECT 1 FROM products WHERE slug = ?", [product.slug]);
    if (existing.length > 0) continue;
    await db.query(
      `INSERT INTO products (slug, position, name, sku, category, active, summary, description,
        attributes, price, sale_price, weight, in_stock, stock_qty, low_stock_mode,
        low_stock_threshold, image) VALUES (?, ?, ?, '', ?, 1, ?, ?, ?, ?, ?, NULL, 1, NULL, 'off', NULL, ?)`,
      [
        product.slug,
        position++,
        product.name,
        product.category,
        product.summary,
        product.description ?? "",
        JSON.stringify(product.attributes ?? []),
        product.price,
        product.salePrice ?? null,
        media(product.image),
      ],
    );
    for (const [index, file] of (product.gallery ?? []).entries()) {
      await db.query("INSERT INTO product_images (product_slug, position, src) VALUES (?, ?, ?)", [
        product.slug,
        index,
        media(file),
      ]);
    }
    added.proizvodi++;
  }

  position = await nextPosition("collections");
  for (const collection of collections) {
    const [result] = await db.query(
      "INSERT IGNORE INTO collections (id, position, name, description) VALUES (?, ?, ?, '')",
      [collection.id, position, collection.name],
    );
    if (result.affectedRows === 0) continue;
    position++;
    added.kolekcije++;
    for (const [index, slug] of collection.slugs.entries()) {
      await db.query(
        "INSERT IGNORE INTO collection_products (collection_id, product_slug, position) VALUES (?, ?, ?)",
        [collection.id, slug, index],
      );
    }
  }

  const [codes] = await db.query("SELECT 1 FROM discounts WHERE id = ? OR code = ?", [discount.id, discount.code]);
  if (codes.length === 0) {
    await db.query(
      `INSERT INTO discounts (id, position, name, code, percent, status, trigger_type, threshold,
        max_uses, expires_at) VALUES (?, ?, ?, ?, ?, 'active', 'public', 0, NULL, NULL)`,
      [discount.id, await nextPosition("discounts"), discount.name, discount.code, discount.percent],
    );
    added.popusti++;
  }

  const [saved] = await db.query("SELECT 1 FROM settings WHERE name = 'settings'");
  if (saved.length === 0) {
    await db.query("INSERT INTO settings (name, value) VALUES ('settings', ?)", [JSON.stringify(settings)]);
    added.podešavanja++;
  }

  await db.commit();
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}

console.log("Dodato:", added);
if (added.podešavanja === 0) {
  console.log("Podešavanja već postoje i nisu menjana. Dostavu, preuzimanje u salonu i plaćanje proverite u panelu.");
}
