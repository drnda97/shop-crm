import {
  categoryPath,
  formatOptions,
  parseOptions,
  slugify,
  syncVariants,
  variantLabel,
  MAX_VARIANTS,
  type Category,
  type Product,
  type ProductOption,
  type Variant,
} from "@/lib/catalog";
import { csvRecords, parseCsv } from "@/lib/csv";
import { MAX_MINOR, toMinor } from "@/lib/format";

/**
 * Uvoz i izvoz proizvoda u CSV-u. Uvoz čita tri oblika: sopstveni (isti koji izvoz pravi),
 * Shopify-jev izvoz proizvoda i WooCommerce-ov izvoz proizvoda. Sva tri se svode na
 * ImportProduct, koji se zatim upisuje u katalog (applyImport).
 *
 * Bez pristupa bazi i disku; slike preuzima onaj ko zove (akcija u panelu).
 */

export type ImportFormat = "shopcrm" | "shopify" | "woocommerce";

export const formatLabels: Record<ImportFormat, string> = {
  shopcrm: "ShopCRM",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
};

export type ImportVariant = {
  values: string[];
  price: number | null;
  salePrice: number | null;
  sku: string;
  stockQty: number | null;
  enabled: boolean;
  /** Adresa slike varijante; mora biti i među slikama proizvoda. */
  image?: string;
};

export type ImportProduct = {
  slug: string;
  name: string;
  active: boolean;
  /** Kategorije kao putanje naziva: [["Nameštaj", "Stolice"], ["Akcija"]]. Prva je glavna. */
  categories: string[][];
  sku: string;
  summary: string;
  description: string;
  price: number | null;
  salePrice: number | null;
  /** Težina u gramima. */
  weight: number | null;
  inStock: boolean;
  stockQty: number | null;
  options: ProductOption[];
  variants: ImportVariant[];
  /** Adrese slika; prva je glavna. */
  images: string[];
  seoTitle: string;
  seoDescription: string;
};

export type ParsedImport = { format: ImportFormat; products: ImportProduct[]; warnings: string[] };

/* ---------- Pomoćne funkcije ---------- */

/** HTML opis (Shopify, WooCommerce) sveden na običan tekst sa pasusima. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truthy(value: string): boolean {
  return /^(1|true|yes|da|active|published|objavljen)$/i.test(value.trim());
}

/** Ceo broj iz CSV-a (komadi, težina); prazan, neispravan ili prevelik za bazu je null. */
function wholeNumber(value: string): number | null {
  const number = Number(value.replace(",", "."));
  return value.trim() !== "" && Number.isFinite(number) && number <= MAX_MINOR ? Math.max(0, Math.round(number)) : null;
}

/** Cena iz CSV-a u najmanjim jedinicama valute; neispravna ili prazna je null. */
function money(value: string, decimals: number): number | null {
  const amount = toMinor(value.replace(/[^\d.,-]/g, ""), decimals);
  return amount === null || Number.isNaN(amount) ? null : amount;
}

/** Redovna i akcijska cena iz para (cena, precrtana cena): veća je redovna. */
function pricePair(price: number | null, compareAt: number | null): { price: number | null; salePrice: number | null } {
  if (price !== null && compareAt !== null && compareAt > price) return { price: compareAt, salePrice: price };
  return { price, salePrice: null };
}

/** Varijanta dobija sopstvenu cenu samo kada se razlikuje od cene proizvoda. */
function ownPrice(variant: { price: number | null; salePrice: number | null }, product: { price: number | null; salePrice: number | null }) {
  const same = variant.price === product.price && variant.salePrice === product.salePrice;
  return same || variant.price === null ? { price: null, salePrice: null } : variant;
}

function addOptionValue(options: ProductOption[], name: string, label: string) {
  if (!name || !label) return;
  let option = options.find((candidate) => candidate.name === name);
  if (!option) options.push((option = { name, values: [] }));
  if (!option.values.some((value) => value.label === label)) option.values.push({ label });
}

/* ---------- Prepoznavanje oblika ---------- */

export function detectFormat(header: string[]): ImportFormat | null {
  const names = header.map((name) => name.trim().toLowerCase());
  const has = (...wanted: string[]) => wanted.every((name) => names.includes(name));
  if (has("oznaka", "naziv")) return "shopcrm";
  if (has("handle", "title") && names.some((name) => name.startsWith("variant "))) return "shopify";
  if (has("type", "name") && names.some((name) => name === "regular price" || name.startsWith("attribute 1"))) {
    return "woocommerce";
  }
  return null;
}

/* ---------- Sopstveni oblik ---------- */

export const EXPORT_HEADER = [
  "oznaka",
  "naziv",
  "status",
  "kategorije",
  "sifra",
  "kratak_opis",
  "opis",
  "cena",
  "cena_na_akciji",
  "tezina_g",
  "na_stanju",
  "komada",
  "opcije",
  "varijanta",
  "u_ponudi",
  "slike",
  "seo_naslov",
  "seo_opis",
];

/**
 * Redovi za izvoz: prvi red proizvoda nosi sve njegove podatke, a svaka varijanta zatim svoj
 * red (ista oznaka, popunjena kolona „varijanta") sa sopstvenom cenom, šifrom i stanjem.
 */
export function exportRows(products: Product[], categories: Category[], decimals: number, base: string): string[][] {
  const amount = (value: number | null) => (value === null ? "" : (value / 10 ** decimals).toFixed(decimals));
  const rows: string[][] = [EXPORT_HEADER];
  for (const product of products) {
    rows.push([
      product.slug,
      product.name,
      product.active ? "objavljen" : "nacrt",
      product.categories
        .map((id) => categoryPath(categories, id).map((category) => category.label).join(" > "))
        .filter(Boolean)
        .join(" | "),
      product.sku,
      product.summary,
      product.description,
      amount(product.price),
      amount(product.salePrice),
      product.weight === null ? "" : String(product.weight),
      product.inStock ? "da" : "ne",
      product.stockQty === null ? "" : String(product.stockQty),
      formatOptions(product.options).replace(/\n/g, " | "),
      "",
      "",
      [product.image, ...product.gallery].flatMap((src) => (src ? [`${base}${src}`] : [])).join(" "),
      product.seoTitle,
      product.seoDescription,
    ]);
    for (const variant of product.variants) {
      const row = EXPORT_HEADER.map(() => "");
      const set = (column: string, value: string) => (row[EXPORT_HEADER.indexOf(column)] = value);
      set("oznaka", product.slug);
      set("varijanta", variantLabel(variant));
      set("sifra", variant.sku);
      set("cena", amount(variant.price));
      set("cena_na_akciji", amount(variant.salePrice));
      set("komada", variant.stockQty === null ? "" : String(variant.stockQty));
      set("u_ponudi", variant.enabled ? "da" : "ne");
      set("slike", variant.image ? `${base}${variant.image}` : "");
      rows.push(row);
    }
  }
  return rows;
}

function fromShopcrm(records: Record<string, string>[], decimals: number, warnings: string[]): ImportProduct[] {
  const products: ImportProduct[] = [];
  for (const [index, record] of records.entries()) {
    const line = index + 2;
    const slug = slugify(record.oznaka ?? "") || slugify(record.naziv ?? "");
    if (!slug) {
      warnings.push(`Red ${line}: nema ni oznaku ni naziv, preskočen.`);
      continue;
    }
    if (record.varijanta) {
      const product = products.find((candidate) => candidate.slug === slug);
      if (!product) {
        warnings.push(`Red ${line}: varijanta „${record.varijanta}" stoji pre svog proizvoda, preskočena.`);
        continue;
      }
      product.variants.push({
        values: record.varijanta.split(",").map((value) => value.trim()),
        price: money(record.cena ?? "", decimals),
        salePrice: money(record.cena_na_akciji ?? "", decimals),
        sku: record.sifra ?? "",
        stockQty: wholeNumber(record.komada ?? ""),
        enabled: record.u_ponudi ? truthy(record.u_ponudi) : true,
        ...(record.slike ? { image: record.slike.split(/\s+/)[0] } : {}),
      });
      continue;
    }
    if (!record.naziv) {
      warnings.push(`Red ${line}: proizvod „${slug}" nema naziv, preskočen.`);
      continue;
    }
    products.push({
      slug,
      name: record.naziv,
      active: record.status ? truthy(record.status) : true,
      categories: (record.kategorije ?? "")
        .split("|")
        .map((path) => path.split(">").map((label) => label.trim()).filter(Boolean))
        .filter((path) => path.length > 0),
      sku: record.sifra ?? "",
      summary: record.kratak_opis ?? "",
      description: record.opis ?? "",
      price: money(record.cena ?? "", decimals),
      salePrice: money(record.cena_na_akciji ?? "", decimals),
      weight: wholeNumber(record.tezina_g ?? ""),
      inStock: record.na_stanju ? truthy(record.na_stanju) : true,
      stockQty: wholeNumber(record.komada ?? ""),
      options: parseOptions((record.opcije ?? "").replace(/\s*\|\s*/g, "\n")),
      variants: [],
      images: (record.slike ?? "").split(/\s+/).filter(Boolean),
      seoTitle: record.seo_naslov ?? "",
      seoDescription: record.seo_opis ?? "",
    });
  }
  return products;
}

/* ---------- Shopify ---------- */

function fromShopify(records: Record<string, string>[], decimals: number, warnings: string[]): ImportProduct[] {
  const products: ImportProduct[] = [];
  for (const [index, record] of records.entries()) {
    const slug = slugify(record.handle ?? "");
    if (!slug) {
      warnings.push(`Red ${index + 2}: nema oznaku (Handle), preskočen.`);
      continue;
    }
    let product = products.find((candidate) => candidate.slug === slug);
    const rowPrice = pricePair(
      money(record["variant price"] ?? "", decimals),
      money(record["variant compare at price"] ?? "", decimals),
    );
    if (!product) {
      if (!record.title) {
        warnings.push(`Red ${index + 2}: proizvod „${slug}" nema naziv (Title), preskočen.`);
        continue;
      }
      // Kategorija: „Type" koji je upisao vlasnik; inače poslednji deo Shopify-jeve kategorije.
      const category = record.type || (record["product category"] ?? "").split(">").pop()?.trim() || "";
      product = {
        slug,
        name: record.title,
        active: record.status ? truthy(record.status) : truthy(record.published ?? "true"),
        categories: category ? [[category]] : [],
        sku: "",
        summary: "",
        description: htmlToText(record["body (html)"] ?? ""),
        ...rowPrice,
        weight: wholeNumber(record["variant grams"] ?? ""),
        inStock: true,
        stockQty: null,
        options: [],
        variants: [],
        images: [],
        seoTitle: record["seo title"] ?? "",
        seoDescription: record["seo description"] ?? "",
      };
      products.push(product);
    }
    if (record["image src"] && !product.images.includes(record["image src"])) {
      product.images.push(record["image src"]);
    }

    // Red sa vrednošću prve opcije je varijanta. „Default Title" znači proizvod bez opcija.
    const values = [1, 2, 3].map((n) => record[`option${n} value`] ?? "").filter(Boolean);
    if (values.length === 0) continue;
    // Shopify vodi stanje samo kada je upisano ko ga prati (Variant Inventory Tracker).
    const stock = record["variant inventory tracker"] ? wholeNumber(record["variant inventory qty"] ?? "") : null;
    if (values[0] === "Default Title") {
      product.sku = record["variant sku"] ?? "";
      product.stockQty = stock;
      continue;
    }
    const first = products.find((candidate) => candidate.slug === slug)!;
    for (const [n, value] of values.entries()) {
      // Naziv opcije stoji samo u prvom redu proizvoda; u ostalim redovima se uzima po mestu.
      const name = record[`option${n + 1} name`] || first.options[n]?.name || `Opcija ${n + 1}`;
      addOptionValue(product.options, name, value);
    }
    const image = record["variant image"];
    if (image && !product.images.includes(image)) product.images.push(image);
    product.variants.push({
      values,
      ...rowPrice,
      sku: record["variant sku"] ?? "",
      stockQty: stock,
      enabled: true,
      ...(image ? { image } : {}),
    });
  }
  for (const product of products) {
    product.variants = product.variants.map((variant) => ({ ...variant, ...ownPrice(variant, product) }));
  }
  return products;
}

/* ---------- WooCommerce ---------- */

function fromWoo(records: Record<string, string>[], header: string[], decimals: number, warnings: string[]): ImportProduct[] {
  // Jedinica težine je u nazivu kolone: „Weight (kg)", „Weight (g)", „Weight (lbs)".
  const weightColumn = header.map((name) => name.trim().toLowerCase()).find((name) => name.startsWith("weight"));
  const toGrams = weightColumn?.includes("(kg)") ? 1000 : weightColumn?.includes("(lbs)") ? 453.592 : weightColumn?.includes("(oz)") ? 28.3495 : 1;
  const attributes = (record: Record<string, string>) =>
    Array.from({ length: 6 }, (_, n) => ({
      name: record[`attribute ${n + 1} name`] ?? "",
      values: (record[`attribute ${n + 1} value(s)`] ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    })).filter((attribute) => attribute.name && attribute.values.length > 0);

  const products: (ImportProduct & { key: string[] })[] = [];
  const taken = new Set<string>();
  for (const [index, record] of records.entries()) {
    const type = (record.type ?? "").toLowerCase();
    const prices = {
      price: money(record["regular price"] ?? "", decimals),
      salePrice: money(record["sale price"] ?? "", decimals),
    };
    if (prices.salePrice !== null && (prices.price === null || prices.salePrice >= prices.price)) prices.salePrice = null;
    const stock = wholeNumber(record.stock ?? "");
    const inStock = record["in stock?"] === "" || record["in stock?"] === undefined ? true : truthy(record["in stock?"]);

    if (type === "variation") {
      // Varijacija pokazuje na roditelja po ID-u („id:123") ili po šifri.
      const parent = (record.parent ?? "").trim();
      const product = products.find((candidate) => candidate.key.includes(parent));
      if (!product) {
        warnings.push(`Red ${index + 2}: varijacija bez roditelja („${parent}"), preskočena.`);
        continue;
      }
      // Vrednosti idu redom opcija roditelja, ne redom kolona u redu varijacije.
      const own = attributes(record);
      const values = product.options.map((option) => own.find((attribute) => attribute.name === option.name)?.values[0] ?? "");
      if (values.some((value) => !value)) {
        warnings.push(`Red ${index + 2}: varijacija proizvoda „${product.name}" nema sve opcije, preskočena.`);
        continue;
      }
      for (const [n, value] of values.entries()) addOptionValue(product.options, product.options[n].name, value);
      const image = (record.images ?? "").split(",")[0]?.trim();
      if (image && !product.images.includes(image)) product.images.push(image);
      product.variants.push({
        values,
        ...prices,
        sku: record.sku ?? "",
        stockQty: stock,
        enabled: inStock && record.published !== "0",
        ...(image ? { image } : {}),
      });
      continue;
    }
    if (type !== "simple" && type !== "variable") {
      if (type) warnings.push(`Red ${index + 2}: vrsta proizvoda „${record.type}" nije podržana, preskočen.`);
      continue;
    }
    if (!record.name) {
      warnings.push(`Red ${index + 2}: proizvod nema naziv (Name), preskočen.`);
      continue;
    }
    let slug = slugify(record.name);
    for (let n = 2; taken.has(slug); n++) slug = `${slugify(record.name)}-${n}`;
    taken.add(slug);
    const weight = Number((record[weightColumn ?? ""] ?? "").replace(",", "."));
    products.push({
      key: [`id:${record.id ?? ""}`, record.sku ?? ""].filter((key) => key && key !== "id:"),
      slug,
      name: record.name,
      active: record.published === "1",
      categories: (record.categories ?? "")
        .split(",")
        .map((path) => path.split(">").map((label) => label.trim()).filter(Boolean))
        .filter((path) => path.length > 0),
      sku: record.sku ?? "",
      summary: htmlToText(record["short description"] ?? "").slice(0, 500),
      description: htmlToText(record.description ?? ""),
      ...prices,
      weight: weight > 0 ? Math.round(weight * toGrams) : null,
      inStock,
      stockQty: type === "simple" ? stock : null,
      // Kod proizvoda sa varijacijama roditelj nosi sve vrednosti svake opcije.
      options: type === "variable" ? attributes(record).map(({ name, values }) => ({ name, values: values.map((label) => ({ label })) })) : [],
      variants: [],
      images: (record.images ?? "").split(",").map((url) => url.trim()).filter(Boolean),
      seoTitle: "",
      seoDescription: "",
    });
  }
  return products.map((entry) => {
    // Ključ za vezivanje varijacija više nije potreban.
    const product: ImportProduct & { key?: string[] } = { ...entry };
    delete product.key;
    // Roditelj sa varijacijama nema svoju cenu: uzima cenu prve varijacije.
    const base = product.price === null && product.variants[0] ? { price: product.variants[0].price, salePrice: product.variants[0].salePrice } : {};
    const merged = { ...product, ...base };
    return { ...merged, variants: merged.variants.map((variant) => ({ ...variant, ...ownPrice(variant, merged) })) };
  });
}

/* ---------- Čitanje fajla ---------- */

/** Čita CSV u jednom od tri oblika. Vraća null kada zaglavlje ne odgovara nijednom. */
export function parseImport(text: string, decimals: number): ParsedImport | null {
  const rows = parseCsv(text);
  const format = detectFormat(rows[0] ?? []);
  if (!format) return null;
  const records = csvRecords(rows);
  const warnings: string[] = [];
  const products =
    format === "shopcrm"
      ? fromShopcrm(records, decimals, warnings)
      : format === "shopify"
        ? fromShopify(records, decimals, warnings)
        : fromWoo(records, rows[0], decimals, warnings);

  for (const product of products) {
    const count = product.options.reduce((total, option) => total * option.values.length, 1);
    if (product.options.length > 0 && count > MAX_VARIANTS) {
      warnings.push(`„${product.name}": opcije daju ${count} kombinacija (najviše ${MAX_VARIANTS}), pa se uvozi bez opcija i varijanti.`);
      product.options = [];
      product.variants = [];
    }
    if (product.price === null && !product.variants.some((variant) => variant.price !== null)) {
      warnings.push(`„${product.name}" nema cenu: biće uvezen, ali neće moći da se poruči dok je ne upišete.`);
    }
  }
  return { format, products, warnings };
}

/* ---------- Upis u katalog ---------- */

export type ImportStats = { created: number; updated: number; categories: number };

/** Kategorija po putanji naziva; one koje ne postoje se prave. Vraća id poslednje u putanji. */
function ensureCategory(categories: Category[], path: string[], stats: ImportStats): string {
  let parent = "";
  for (const label of path) {
    let category = categories.find(
      (candidate) => candidate.parent === parent && candidate.label.toLowerCase() === label.toLowerCase(),
    );
    if (!category) {
      let id = slugify(label) || "kategorija";
      for (let n = 2; categories.some((candidate) => candidate.id === id); n++) id = `${slugify(label) || "kategorija"}-${n}`;
      category = { id, label: label.slice(0, 255), parent, description: "", seoTitle: "", seoDescription: "" };
      categories.push(category);
      stats.categories++;
    }
    parent = category.id;
  }
  return parent;
}

/**
 * Upisuje uvezene proizvode u katalog. Proizvod sa oznakom koja već postoji se menja (opis,
 * cene, stanje, kategorije, opcije i varijante), a ono što CSV ne nosi — dodatne sekcije,
 * istaknuti deo, slični proizvodi — ostaje. `images` prevodi adresu slike iz CSV-a u putanju
 * ubačene slike; slike se menjaju samo kada je bar jedna preuzeta.
 */
export function applyImport(
  content: { products: Product[]; categories: Category[] },
  items: ImportProduct[],
  images: Map<string, string>,
): ImportStats {
  const stats: ImportStats = { created: 0, updated: 0, categories: 0 };
  for (const item of items) {
    const existing = content.products.find((product) => product.slug === item.slug);
    const categories = [...new Set(item.categories.map((path) => ensureCategory(content.categories, path, stats)))];
    const sources = item.images.flatMap((url) => (images.has(url) ? [images.get(url) as string] : []));
    const [image, ...gallery] = sources.length > 0 ? sources : [existing?.image, ...(existing?.gallery ?? [])];
    const available = [image, ...gallery];

    const variants: Variant[] = syncVariants(item.options, existing?.variants ?? []).map((variant) => {
      const row = item.variants.find((candidate) => candidate.values.join("\u0000") === variant.values.join("\u0000"));
      // Kombinacija koje nema u CSV-u se ne pravi: ostaje u tabeli, ali isključena.
      if (!row) return item.variants.length > 0 ? { ...variant, enabled: false } : variant;
      const picked = row.image ? images.get(row.image) : undefined;
      return {
        id: variant.id,
        values: variant.values,
        price: row.price,
        salePrice: row.price !== null && row.salePrice !== null && row.salePrice < row.price ? row.salePrice : null,
        sku: row.sku.slice(0, 64),
        stockQty: row.stockQty,
        enabled: row.enabled,
        ...(picked && available.includes(picked) ? { image: picked } : variant.image ? { image: variant.image } : {}),
      };
    });

    const product: Product = {
      attributes: [],
      lowStockMode: "off",
      lowStockThreshold: null,
      highlight: { heading: "", text: "", specs: [] },
      related: [],
      ...existing,
      slug: item.slug,
      name: item.name.slice(0, 255),
      sku: item.sku.slice(0, 64),
      category: categories[0] ?? "",
      categories,
      active: item.active,
      summary: item.summary.slice(0, 500),
      description: item.description,
      price: item.price,
      salePrice: item.price !== null && item.salePrice !== null && item.salePrice < item.price ? item.salePrice : null,
      weight: item.weight,
      inStock: item.inStock,
      stockQty: item.stockQty,
      ...(image ? { image } : {}),
      gallery: gallery.flatMap((src) => (src ? [src] : [])),
      options: item.options,
      variants,
      seoTitle: item.seoTitle.slice(0, 255),
      seoDescription: item.seoDescription.slice(0, 500),
    };
    if (existing) {
      content.products = content.products.map((candidate) => (candidate.slug === item.slug ? product : candidate));
      stats.updated++;
    } else {
      content.products.push(product);
      stats.created++;
    }
  }
  return stats;
}
