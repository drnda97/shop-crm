// Demo sadržaj za javnu prodavnicu: proizvodi iz dizajna sa opisima, kategorije, kolekcije
// (oznake „Novo" i „Bestseler"), promo kod dobrodošlice, podešavanja dostave i plaćanja,
// popunjene početne stranice, blog, kupci sa porudžbinama i utisci (scripts/demo-content.mjs).
//
//   npm run seed:demo
//
// Dodaje samo ono čega nema: postojeći proizvodi, kolekcije, popusti i podešavanja se ne
// menjaju, a na stranicama i u podešavanjima se popunjava samo polje koje je prazno ili još
// ima početni tekst. Bezbedno je pokrenuti je više puta. Podatke za bazu čita iz .env.local.
// Tabele pravi sama aplikacija pri prvom pokretanju (npm run dev), pa nju pokrenite pre skripte.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { syncVariants } from "../lib/catalog.ts";
import { DEFAULT_PAGES } from "../lib/default-pages.ts";
import { makeSizes } from "../lib/images.ts";
import { customerKey } from "../lib/orders.ts";
import { hashPassword } from "../lib/password.ts";
import { mergeSettings } from "../lib/settings.ts";
import * as demo from "./demo-content.mjs";

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
    // Opcije koje kupac bira i istaknuti deo stranice proizvoda.
    options: [
      { name: "Tkanina", values: [{ label: "Pesak", color: "#b9ab98" }, { label: "Grafit", color: "#3c4346" }, { label: "Maslina", color: "#6b6a45" }] },
      { name: "Postolje", values: [{ label: "Hrast" }, { label: "Orah" }, { label: "Crni jasen" }] },
    ],
    highlight: {
      heading: "Napravljena da se popravlja, ne da se baca",
      text: "Navlaka se skida i pere, a sedište i postolje se menjaju posebno. Rezervne delove čuvamo deset godina.",
      specs: [
        { label: "Širina", value: "72 cm" },
        { label: "Visina sedišta", value: "41 cm" },
        { label: "Nosivost", value: "130 kg" },
      ],
      image: "ds-detail-a.jpg",
    },
    description:
      "Niska fotelja koja se okreće za 360°, sa sedištem od hladno livene pene i postoljem od masivnog hrasta. Dovoljno mala za ugao, dovoljno udobna za celo veče.",
    attributes: [
      { title: "Opis", text: "Sedište je oblikovano od hladno livene pene preko čeličnog rama, pa zadržava formu godinama. Okretni mehanizam je skriven u postolju i radi bez zvuka." },
      { title: "Materijali i održavanje", text: "Tkanina: 62% vuna, 38% lan. Postolje: masivni hrast, uljen. Navlaka se skida i pere na 30°C. Drvo brisati suvom krpom i jednom godišnje premazati uljem." },
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
  store: { name: "Demo Shop", ...demo.store },
  shipping: { price: 1200, freeEnabled: true, freeFrom: 50000, pickupEnabled: true },
  payment: { cod: true, bank: true, bankInstructions: demo.bankInstructions },
};

// Demo tekst ide samo u polje koje još ima početnu vrednost: `current` je sadržaj iz baze,
// `initial` početni sadržaj, `patch` demo tekst. Vraća da li je nešto promenjeno.
function fillDemo(current, initial, patch) {
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    if (current?.[key] === undefined) continue;
    if (typeof value === "object") {
      changed = fillDemo(current[key], initial?.[key], value) || changed;
    } else if (current[key] === (initial?.[key] ?? "") && current[key] !== value) {
      current[key] = value;
      changed = true;
    }
  }
  return changed;
}

const hasPlaceholder = (value) => /\[[^\]]*(Dopunite|dopunite|NAZIV|BROJ|ADRESA|OD\]|Ime kupca|Utisak|Grad\])/.test(JSON.stringify(value));
const daysAgo = (days, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, (days * 17) % 60, 0, 0);
  return date;
};

// Slike idu tamo gde ih čuva i panel (storage/uploads), pa se vide i menjaju iz njega.
const sourceDir = path.join(process.cwd(), "public", "shop");
const uploadsDir = UPLOADS_DIR ?? path.join(process.cwd(), "storage", "uploads");
mkdirSync(uploadsDir, { recursive: true });

// Kao i slike ubačene iz panela: WebP u više širina (lib/images.ts).
async function media(file) {
  const base = file.replace(/\.[a-z]+$/, "");
  if (!existsSync(path.join(uploadsDir, `${base}-full.webp`))) {
    for (const item of await makeSizes(readFileSync(path.join(sourceDir, file)), base)) {
      writeFileSync(path.join(uploadsDir, item.name), item.data);
    }
  }
  return `/media/${base}-full.webp`;
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

const added = {
  kategorije: 0,
  proizvodi: 0,
  opisi: 0,
  kolekcije: 0,
  popusti: 0,
  podešavanja: 0,
  stranice: 0,
  članci: 0,
  kupci: 0,
  porudžbine: 0,
  utisci: 0,
};

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
  for (const demoProduct of products) {
    const product = { ...demoProduct, ...demo.productDetails[demoProduct.slug] };
    const [existing] = await db.query("SELECT description, attributes FROM products WHERE slug = ?", [product.slug]);
    if (existing.length > 0) {
      // Proizvod dodat ranijom verzijom skripte dobija opis, ako ga vlasnik nije upisao.
      const details = demo.productDetails[product.slug];
      if (details && existing[0].description === "" && JSON.parse(existing[0].attributes || "[]").length === 0) {
        await db.query("UPDATE products SET description = ?, attributes = ? WHERE slug = ?", [
          details.description,
          JSON.stringify(details.attributes),
          product.slug,
        ]);
        added.opisi++;
      }
      continue;
    }
    await db.query(
      `INSERT INTO products (slug, position, name, sku, category, active, summary, description,
        attributes, price, sale_price, weight, in_stock, stock_qty, low_stock_mode,
        low_stock_threshold, image, options, highlight)
        VALUES (?, ?, ?, '', ?, 1, ?, ?, ?, ?, ?, NULL, 1, NULL, 'off', NULL, ?, ?, ?)`,
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
        await media(product.image),
        JSON.stringify(product.options ?? []),
        JSON.stringify(
          product.highlight
            ? { ...product.highlight, image: await media(product.highlight.image) }
            : { heading: "", text: "", specs: [] },
        ),
      ],
    );
    // Svaka kombinacija opcija je varijanta, bez sopstvene cene i stanja.
    for (const [index, variant] of syncVariants(product.options ?? [], []).entries()) {
      await db.query(
        "INSERT INTO product_variants (product_slug, id, position, option_values) VALUES (?, ?, ?, ?)",
        [product.slug, variant.id, index, JSON.stringify(variant.values)],
      );
    }
    for (const [index, file] of (product.gallery ?? []).entries()) {
      await db.query("INSERT INTO product_images (product_slug, position, src) VALUES (?, ?, ?)", [
        product.slug,
        index,
        await media(file),
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

  const [saved] = await db.query("SELECT value FROM settings WHERE name = 'settings'");
  if (saved.length === 0) {
    await db.query("INSERT INTO settings (name, value) VALUES ('settings', ?)", [
      JSON.stringify({ ...settings, site: { ...mergeSettings({}).site, announcement: demo.announcement, legalLinks: demo.legalLinks } }),
    ]);
    added.podešavanja++;
  } else {
    // Postojeća podešavanja: popunjavaju se samo prazni podaci prodavnice i mesta za dopunu.
    const value = JSON.parse(saved[0].value);
    let changed = false;
    value.store ??= {};
    for (const [key, text] of Object.entries(demo.store)) {
      if (!value.store[key]) {
        value.store[key] = text;
        changed = true;
      }
    }
    if (value.payment && (!value.payment.bankInstructions || hasPlaceholder(value.payment.bankInstructions))) {
      value.payment.bankInstructions = demo.bankInstructions;
      changed = true;
    }
    let text = JSON.stringify(value);
    for (const [token, replacement] of Object.entries(demo.placeholderValues)) text = text.replaceAll(token, replacement);
    if (text !== JSON.stringify(value)) {
      Object.assign(value, JSON.parse(text));
      changed = true;
    }
    value.site = mergeSettings(value).site;
    if (!value.site.announcement) {
      value.site.announcement = demo.announcement;
      changed = true;
    }
    if (value.site.legalLinks.length === 0) {
      value.site.legalLinks = demo.legalLinks;
      changed = true;
    }
    if (changed) {
      await db.query("UPDATE settings SET value = ? WHERE name = 'settings'", [JSON.stringify(value)]);
      added.podešavanja++;
    }
  }

  // Početne stranice (lib/default-pages.ts): mesta za dopunu dobijaju demo tekst.
  for (const page of DEFAULT_PAGES) {
    const patch = demo.pageTexts[page.slug];
    if (!patch) continue;
    const [rows] = await db.query("SELECT sections, published FROM pages WHERE slug = ?", [page.slug]);
    if (rows.length === 0 || !rows[0].sections) continue;
    const sections = JSON.parse(rows[0].sections);
    let changed = false;
    for (const [id, data] of Object.entries(patch)) {
      const section = sections.find((candidate) => candidate.id === id);
      const initial = page.sections.find((candidate) => candidate.id === id);
      if (section && initial) changed = fillDemo(section.data, initial.data, data) || changed;
    }
    const publish = demo.publishPages.includes(page.slug) && !rows[0].published && !hasPlaceholder(sections);
    if (changed || publish) {
      await db.query("UPDATE pages SET sections = ?, published = ? WHERE slug = ?", [
        JSON.stringify(sections),
        publish ? 1 : rows[0].published,
        page.slug,
      ]);
      added.stranice++;
    }
  }

  for (const post of demo.posts) {
    const [existing] = await db.query("SELECT 1 FROM blog_posts WHERE slug = ?", [post.slug]);
    if (existing.length > 0) continue;
    const at = daysAgo(post.daysAgo, 9);
    await db.query(
      `INSERT INTO blog_posts (slug, title, excerpt, body, image, image_alt, author, tags, status,
        published_at, seo_title, seo_description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, '', '', ?)`,
      [post.slug, post.title, post.excerpt, post.body, await media(post.image), post.imageAlt, post.author, post.tags, at, at],
    );
    added.članci++;
  }

  // Kupci, porudžbine i utisci idu zajedno, i samo u bazu koja još nema demo kupce.
  const [known] = await db.query("SELECT 1 FROM shop_users WHERE email = ?", [demo.customers[0].email]);
  if (known.length === 0) {
    const shop = mergeSettings(saved.length > 0 ? JSON.parse(saved[0].value) : settings);
    const delivery = shop.shipping.methods.find((method) => method.kind === "delivery");
    const pickup = shop.shipping.methods.find((method) => method.kind === "pickup") ?? delivery;
    const prefix = shop.store.phonePrefix;
    const userIds = [];
    for (const [index, customer] of demo.customers.entries()) {
      const [result] = await db.query(
        `INSERT INTO shop_users (email, first_name, last_name, pass_hash, created_at, phone, street, city, postal_code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customer.email,
          customer.first,
          customer.last,
          hashPassword(crypto.randomUUID()),
          daysAgo(90 - index * 3, 8),
          customer.phone,
          customer.street,
          customer.city,
          customer.postal,
        ],
      );
      userIds.push(result.insertId);
      added.kupci++;
    }

    const [catalog] = await db.query("SELECT slug, name, price, sale_price FROM products");
    const bySlug = new Map(catalog.map((row) => [row.slug, row]));
    const steps = { new: [], confirmed: ["confirmed"], shipped: ["confirmed", "shipped"], delivered: ["confirmed", "shipped", "delivered"], cancelled: ["cancelled"] };
    const labels = { confirmed: "Potvrđena", shipped: "Poslata", delivered: "Isporučena", cancelled: "Otkazana" };
    for (const order of demo.orders) {
      const customer = demo.customers[order.customer];
      const items = order.items
        .filter(([slug]) => bySlug.has(slug))
        .map(([slug, qty, variant]) => {
          const row = bySlug.get(slug);
          return { slug, qty, name: row.name, price: row.sale_price ?? row.price, variant: variant ?? [] };
        });
      if (items.length === 0) continue;
      const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const discountAmount = order.welcome ? Math.round((subtotal * discount.percent) / 100) : 0;
      const method = order.pickup ? pickup : delivery;
      const free = method.freeFrom !== null && subtotal - discountAmount >= method.freeFrom;
      const shippingPrice = order.pickup || free ? 0 : method.price;
      const receivedAt = daysAgo(order.daysAgo, 9 + (order.daysAgo % 11));
      const paid = order.payment === "bank" && order.status !== "new" && order.status !== "cancelled";
      const sent = steps[order.status].includes("shipped");
      const [result] = await db.query(
        `INSERT INTO orders (received_at, status, customer_key, customer_name, phone, email, street, city,
          postal_code, note, payment_method, subtotal, delivery, total, discount_code, discount_percent,
          discount_amount, discount_name, discount_id, delivery_method, pickup, tracking_number, paid_at, lang)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sr')`,
        [
          receivedAt,
          order.status,
          customerKey(customer, prefix),
          `${customer.first} ${customer.last}`,
          customer.phone,
          customer.email,
          customer.street,
          customer.city,
          customer.postal,
          order.payment,
          subtotal,
          shippingPrice,
          subtotal - discountAmount + shippingPrice,
          order.welcome ? discount.code : null,
          order.welcome ? discount.percent : null,
          discountAmount,
          order.welcome ? discount.name : null,
          order.welcome ? discount.id : null,
          method.name,
          order.pickup ? 1 : 0,
          sent && !order.pickup ? `DS${String(receivedAt.getTime()).slice(-8)}` : "",
          paid ? new Date(receivedAt.getTime() + 86400000) : null,
        ],
      );
      const number = result.insertId;
      for (const [position, item] of items.entries()) {
        await db.query(
          "INSERT INTO order_items (order_number, position, slug, name, sku, qty, price, variant, variant_id) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?)",
          [
            number,
            position,
            item.slug,
            item.name,
            item.qty,
            item.price,
            item.variant.join(", "),
            item.variant.map((value) => value.toLowerCase().replace(/\s+/g, "-")).join("-"),
          ],
        );
      }
      await db.query("INSERT INTO order_events (order_number, at, text) VALUES (?, ?, ?)", [number, receivedAt, "Porudžbina primljena sa sajta"]);
      for (const [day, status] of steps[order.status].entries()) {
        await db.query("INSERT INTO order_events (order_number, at, text) VALUES (?, ?, ?)", [
          number,
          new Date(receivedAt.getTime() + (day + 1) * 86400000 * (status === "delivered" ? 2 : 1)),
          `Status: ${labels[status]}`,
        ]);
      }
      await db.query("INSERT INTO shop_user_orders (user_id, order_number) VALUES (?, ?)", [userIds[order.customer], number]);
      added.porudžbine++;
    }

    for (const review of demo.reviews) {
      const customer = demo.customers[review.customer];
      if (!bySlug.has(review.product)) continue;
      await db.query(
        `INSERT INTO reviews (product_slug, user_id, name, rating, body, created_at, status, verified)
          VALUES (?, ?, ?, ?, ?, ?, 'approved', 1)`,
        [review.product, userIds[review.customer], `${customer.first} ${customer.last[0]}.`, review.rating, review.body, daysAgo(review.daysAgo, 19)],
      );
      added.utisci++;
    }
  }

  // Spisak proizvoda za kolekciju i pretragu (lib/listing.ts) pravi aplikacija: bez oznake
  // verzije ga pri sledećem pokretanju napravi ponovo, sa novim proizvodima.
  if (added.proizvodi > 0) await db.query("DELETE FROM settings WHERE name = 'listing'");
  await db.commit();
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}

console.log("Dodato:", added);
if (added.proizvodi > 0) console.log("Ako server već radi, pokrenite ga ponovo da se novi proizvodi vide na stranici kolekcije.");
if (added.podešavanja === 0) {
  console.log("Podešavanja već postoje i nisu menjana. Dostavu, preuzimanje u salonu i plaćanje proverite u panelu.");
}
