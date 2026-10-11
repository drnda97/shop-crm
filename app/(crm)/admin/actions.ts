"use server";

import { existsSync } from "node:fs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_PATH,
  checkCredentials,
  createSession,
  destroySession,
  requireAdmin,
} from "@/lib/admin-auth";
import {
  countCombinations,
  HOME_SLUG,
  MAX_VARIANTS,
  parseOptions,
  parsePairs,
  RESERVED_SLUGS,
  slugify,
  syncVariants,
  withDescendants,
  type LowStockMode,
  type Product,
} from "@/lib/catalog";
import {
  getCategories,
  getCollections,
  getDiscounts,
  getPages,
  getProducts,
  getSettings,
  getUsedImages,
  removeUpload,
  saveImage,
  saveUpload,
  setStoredValue,
  updateContent,
  uploadPath,
  type UploadResult,
  getStoredValue,
} from "@/lib/content";
import { setCustomerNote } from "@/lib/customers";
import {
  isValidCode,
  normalizeCode,
  triggerLabels,
  type Discount,
  type DiscountTrigger,
} from "@/lib/discounts";
import { toMinor } from "@/lib/format";
import {
  MAX_TEMPLATE_BYTES,
  removeCustomTemplate,
  saveCustomTemplate,
  sendTestEmail,
} from "@/lib/order-email";
import { setOrderNote, setOrderStatus } from "@/lib/order-store";
import { orderStatusLabels, type OrderStatus } from "@/lib/orders";
import { applyImport, parseImport, type ParsedImport } from "@/lib/product-import";
import { clientIp, TOO_MANY, tooMany } from "@/lib/rate-limit";
import { fetchImage } from "@/lib/remote-image";
import { newSection, normalizeData, normalizeSections } from "@/lib/sections";
import { defaultSettings, mergeSettings } from "@/lib/settings";
import { mergeSite } from "@/lib/site";
import { IMPORT_KEY } from "./import-key";
import type { VariantRow } from "./variants-editor";
import { deleteMessage } from "@/lib/storefront/inbox";
import { PREVIEW_KEY, type PreviewDraft, type SettingsDraft } from "@/lib/storefront/pages";
import { template, type Templates } from "@/lib/templates";
import { isFontId, isHexColor, type ThemeColors } from "@/lib/theme";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  // Pregledač višeredni tekst šalje sa \r\n; čuva se sa \n.
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

/** Ceo broj veći od nule, ili null kada je polje prazno ili neispravno. */
function wholeNumber(formData: FormData, name: string): number | null {
  const value = Number(text(formData, name));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/** Broj komada iz forme: null kada je polje prazno, false kada nije ceo broj od nule naviše. */
function optionalCount(formData: FormData, name: string): number | null | false {
  const value = text(formData, name);
  if (value === "") return null;
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : false;
}

function image(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

/** Slug iz naziva koji nije zauzet; po potrebi dobija nastavak -2, -3… */
function uniqueSlug(name: string, taken: string[]): string {
  const base = slugify(name);
  if (!base) return "";
  let slug = base;
  for (let n = 2; taken.includes(slug); n++) slug = `${base}-${n}`;
  return slug;
}

function backWithError(path: string, message: string): never {
  redirect(`${path}?greska=${encodeURIComponent(message)}`);
}

/** Stranice panela već otvorene u pregledaču dobijaju svež sadržaj pri sledećem prelasku. */
function refresh() {
  revalidatePath(ADMIN_PATH, "layout");
}

/* ---------- Prijava ---------- */

export type LoginState = { error?: string };

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  if (tooMany("admin-login", clientIp(await headers()), 10)) return { error: TOO_MANY };
  if (!checkCredentials(text(formData, "username"), text(formData, "password"))) {
    // Usporava nagađanje lozinke.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { error: "Pogrešno korisničko ime ili lozinka." };
  }
  await createSession();
  redirect(ADMIN_PATH);
}

export async function logout() {
  await destroySession();
  redirect(ADMIN_PATH);
}

/* ---------- Proizvodi ---------- */

const PRODUCTS_PATH = `${ADMIN_PATH}/proizvodi`;

/** „Naslov: tekst" po redu → dodatne sekcije stranice proizvoda. */
function parseAttributes(value: string): Product["attributes"] {
  return parsePairs(value).map(([title, text]) => ({ title, text }));
}

export async function saveProductAction(formData: FormData) {
  await requireAdmin();

  const [products, categories, settings] = await Promise.all([
    getProducts(),
    getCategories(),
    getSettings(),
  ]);
  const editedSlug = text(formData, "slug");
  const existing = products.find((product) => product.slug === editedSlug);
  const formPath = existing ? `${PRODUCTS_PATH}/${existing.slug}` : `${PRODUCTS_PATH}/novi`;
  if (editedSlug && !existing) backWithError(PRODUCTS_PATH, "Proizvod više ne postoji.");

  const name = text(formData, "name");
  if (!name) backWithError(formPath, "Upišite naziv proizvoda.");

  const category = text(formData, "category");
  if (category !== "" && !categories.some((candidate) => candidate.id === category)) {
    backWithError(formPath, "Izabrana kategorija više ne postoji.");
  }
  // Glavna kategorija je prva; dodatne su one označene u formi koje još postoje.
  const extra = formData
    .getAll("categories")
    .filter((value): value is string => typeof value === "string")
    .filter((id) => id !== category && categories.some((candidate) => candidate.id === id));
  const productCategories = [...new Set([...(category ? [category] : []), ...extra])];

  // Slug se pravi jednom, pri dodavanju, i više se ne menja — da linkovi i korpe kupaca ostanu ispravni.
  const slug =
    existing?.slug ?? uniqueSlug(name, ["novi", ...products.map((product) => product.slug)]);
  if (!slug) backWithError(formPath, "Naziv mora da sadrži bar jedno slovo ili cifru.");

  // Cene: prazno polje za cenu znači da još nije upisana; prazna akcijska cena gasi akciju.
  const decimals = settings.store.currencyDecimals;
  const price = toMinor(text(formData, "price"), decimals);
  const salePrice = toMinor(text(formData, "salePrice"), decimals);
  if (Number.isNaN(price) || Number.isNaN(salePrice)) {
    backWithError(formPath, "Cena je broj, npr. 1250 ili 12,50.");
  }
  if (salePrice !== null && (price === null || salePrice >= price)) {
    backWithError(formPath, "Cena na akciji mora biti niža od redovne cene.");
  }

  // Stanje: prazno polje za broj znači da se broj ne vodi i da važi ručno stanje.
  const stockQty = optionalCount(formData, "stockQty");
  if (stockQty === false)
    backWithError(formPath, "Broj komada na stanju je ceo broj, nula ili više.");
  const modeValue = text(formData, "lowStockMode");
  const lowStockMode: LowStockMode =
    modeValue === "always" || modeValue === "auto" ? modeValue : "off";
  const lowStockThreshold = optionalCount(formData, "lowStockThreshold");
  if (lowStockThreshold === false) backWithError(formPath, "Prag je ceo broj komada.");
  if (lowStockMode === "auto" && (stockQty === null || !lowStockThreshold)) {
    backWithError(
      formPath,
      "Da bi se oznaka „pri kraju“ prikazivala sama, upišite i broj komada na stanju i prag.",
    );
  }

  let imageSrc = existing?.image;
  const file = image(formData, "image");
  if (file) {
    const upload = await saveUpload(file, slug);
    if (!upload.ok) backWithError(formPath, upload.error);
    imageSrc = upload.src;
  }

  // Galerija: označene slike se uklanjaju, nove se dodaju na kraj.
  const removed = formData.getAll("galleryRemove").filter((value) => typeof value === "string");
  const gallery = (existing?.gallery ?? []).filter((src) => !removed.includes(src));
  const added: string[] = [];
  for (const value of formData.getAll("gallery")) {
    if (!(value instanceof File) || value.size === 0) continue;
    const upload = await saveUpload(value, slug);
    if (!upload.ok) {
      // Ništa se ne čuva napola: već primljene slike iz ovog slanja se brišu.
      for (const src of added) await removeUpload(src);
      if (file) await removeUpload(imageSrc);
      backWithError(formPath, upload.error);
    }
    added.push(upload.src);
  }
  gallery.push(...added);

  // Istaknuti deo: nova slika zamenjuje staru, „Ukloni" je briše.
  let highlightImage = existing?.highlight.image;
  const highlightFile = image(formData, "highlightImage");
  if (highlightFile) {
    const upload = await saveUpload(highlightFile, slug);
    if (!upload.ok) backWithError(formPath, upload.error);
    highlightImage = upload.src;
  } else if (formData.get("highlightImageRemove") === "on") {
    highlightImage = undefined;
  }

  // Varijante: jedna za svaku kombinaciju opcija; cena, šifra i stanje stižu iz tabele u formi.
  const options = parseOptions(text(formData, "options"));
  if (countCombinations(options) > MAX_VARIANTS) {
    backWithError(formPath, `Opcije daju više od ${MAX_VARIANTS} kombinacija. Smanjite broj vrednosti.`);
  }
  let rows: Record<string, Partial<VariantRow>> = {};
  try {
    rows = JSON.parse(text(formData, "variants") || "{}");
  } catch {
    rows = {};
  }
  const images = [imageSrc, ...gallery];
  const variants = syncVariants(options, existing?.variants ?? []).map((variant) => {
    const row = rows[variant.id];
    // Varijanta koje nema u formi (forma poslata bez tabele) ostaje kakva jeste.
    if (typeof row !== "object" || row === null) return variant;
    const label = variant.values.join(", ");
    const own = toMinor(String(row.price ?? ""), decimals);
    const sale = toMinor(String(row.salePrice ?? ""), decimals);
    if (Number.isNaN(own) || Number.isNaN(sale)) {
      backWithError(formPath, `Varijanta „${label}": cena je broj, npr. 1250 ili 12,50.`);
    }
    if (sale !== null && (own === null || sale >= own)) {
      backWithError(formPath, `Varijanta „${label}": cena na akciji traži upisanu cenu varijante i mora biti niža od nje.`);
    }
    const stock = String(row.stockQty ?? "").trim();
    const qty = stock === "" ? null : Number(stock);
    if (qty !== null && (!Number.isInteger(qty) || qty < 0)) {
      backWithError(formPath, `Varijanta „${label}": broj komada je ceo broj, nula ili više.`);
    }
    const picked = typeof row.image === "string" && images.includes(row.image) ? row.image : undefined;
    return {
      id: variant.id,
      values: variant.values,
      price: own,
      salePrice: sale,
      sku: String(row.sku ?? "").trim().slice(0, 64),
      stockQty: qty,
      ...(picked ? { image: picked } : {}),
      enabled: row.enabled !== false,
    };
  });

  const product: Product = {
    slug,
    name,
    sku: text(formData, "sku").slice(0, 64),
    category: productCategories[0] ?? "",
    categories: productCategories,
    seoTitle: text(formData, "seoTitle").slice(0, 255),
    seoDescription: text(formData, "seoDescription").slice(0, 500),
    related: formData
      .getAll("related")
      .filter((value): value is string => typeof value === "string")
      .filter((value) => value !== slug && products.some((candidate) => candidate.slug === value))
      .slice(0, 12),
    active: text(formData, "status") !== "draft",
    summary: text(formData, "summary").slice(0, 500),
    description: text(formData, "description"),
    attributes: parseAttributes(text(formData, "attributes")),
    price,
    salePrice,
    weight: wholeNumber(formData, "weight"),
    inStock: text(formData, "inStock") !== "no",
    stockQty,
    lowStockMode,
    lowStockThreshold,
    image: imageSrc,
    gallery,
    options,
    variants,
    highlight: {
      heading: text(formData, "highlightHeading").slice(0, 200),
      text: text(formData, "highlightText").slice(0, 2000),
      specs: parsePairs(text(formData, "highlightSpecs"))
        .slice(0, 8)
        .map(([label, value]) => ({ label, value })),
      ...(highlightImage ? { image: highlightImage } : {}),
    },
  };
  await updateContent((content) => {
    content.products = existing
      ? content.products.map((item) => (item.slug === slug ? product : item))
      : [...content.products, product];
  });
  if (file) await removeUpload(existing?.image);
  if (highlightImage !== existing?.highlight.image) await removeUpload(existing?.highlight.image);
  for (const src of existing?.gallery ?? []) {
    if (removed.includes(src)) await removeUpload(src);
  }

  refresh();
  redirect(PRODUCTS_PATH);
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();

  const slug = text(formData, "slug");
  const product = (await getProducts()).find((candidate) => candidate.slug === slug);
  if (product) {
    await updateContent((content) => {
      content.products = content.products.filter((item) => item.slug !== slug);
      for (const collection of content.collections) {
        collection.productSlugs = collection.productSlugs.filter((item) => item !== slug);
      }
    });
    await removeUpload(product.image);
    await removeUpload(product.highlight.image);
    for (const src of product.gallery) await removeUpload(src);
    refresh();
  }
  redirect(PRODUCTS_PATH);
}

/** Brza izmena stanja iz spiska proizvoda: klik menja ručno stanje, a broj se upisuje direktno. */
export async function setStockAction(formData: FormData) {
  await requireAdmin();

  const slug = text(formData, "slug");
  const stockQty = formData.has("stockQty") ? optionalCount(formData, "stockQty") : undefined;
  if (stockQty === false)
    backWithError(PRODUCTS_PATH, "Broj komada na stanju je ceo broj, nula ili više.");

  await updateContent((content) => {
    const product = content.products.find((item) => item.slug === slug);
    if (!product) return;
    if (stockQty === undefined) product.inStock = !product.inStock;
    else product.stockQty = stockQty;
  });
  refresh();
  redirect(PRODUCTS_PATH);
}

/** Pomera proizvod za jedno mesto gore ili dole; tim redom ih API vraća sajtu. */
export async function moveProductAction(formData: FormData) {
  await requireAdmin();

  const slug = text(formData, "slug");
  const step = text(formData, "direction") === "up" ? -1 : 1;
  await updateContent((content) => {
    const index = content.products.findIndex((item) => item.slug === slug);
    const target = index + step;
    if (index === -1 || target < 0 || target >= content.products.length) return;
    const [product] = content.products.splice(index, 1);
    content.products.splice(target, 0, product);
  });
  refresh();
  redirect(PRODUCTS_PATH);
}

/* ---------- Više proizvoda odjednom ---------- */

/** Ista izmena na svim označenim proizvodima iz spiska. */
export async function bulkProductsAction(formData: FormData) {
  await requireAdmin();

  const slugs = formData.getAll("slugs").filter((value): value is string => typeof value === "string");
  if (slugs.length === 0) backWithError(PRODUCTS_PATH, "Označite bar jedan proizvod.");
  const operation = text(formData, "operation");
  const category = text(formData, "category");
  const percent = Number(text(formData, "percent").replace(",", "."));
  const categories = await getCategories();

  if ((operation === "addCategory" || operation === "removeCategory") && !categories.some((item) => item.id === category)) {
    backWithError(PRODUCTS_PATH, "Izaberite kategoriju.");
  }
  if (operation === "price" && (!Number.isFinite(percent) || percent === 0 || percent <= -100 || percent > 1000)) {
    backWithError(PRODUCTS_PATH, "Upišite procenat promene cene, npr. 10 ili -15.");
  }
  // Cena se menja za procenat i zaokružuje na ceo iznos u najmanjoj jedinici valute.
  const scale = (value: number | null) => (value === null ? null : Math.max(0, Math.round(value * (1 + percent / 100))));
  const removed: Product[] = [];

  await updateContent((content) => {
    const picked = content.products.filter((product) => slugs.includes(product.slug));
    for (const product of picked) {
      if (operation === "publish") product.active = true;
      else if (operation === "draft") product.active = false;
      else if (operation === "addCategory") {
        product.categories = [...new Set([...product.categories, category])];
        product.category = product.categories[0];
      } else if (operation === "removeCategory") {
        product.categories = product.categories.filter((id) => id !== category);
        product.category = product.categories[0] ?? "";
      } else if (operation === "price") {
        product.price = scale(product.price);
        product.salePrice = scale(product.salePrice);
        for (const variant of product.variants) {
          variant.price = scale(variant.price);
          variant.salePrice = scale(variant.salePrice);
        }
      }
    }
    if (operation === "delete") {
      removed.push(...picked);
      content.products = content.products.filter((product) => !slugs.includes(product.slug));
      for (const collection of content.collections) {
        collection.productSlugs = collection.productSlugs.filter((slug) => !slugs.includes(slug));
      }
    }
  }, "Izmena više proizvoda");
  for (const product of removed) {
    for (const src of [product.image, product.highlight.image, ...product.gallery]) await removeUpload(src);
  }

  refreshSite();
  redirect(PRODUCTS_PATH);
}

/* ---------- Uvoz proizvoda ---------- */

const IMPORT_PATH = `${PRODUCTS_PATH}/uvoz`;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
/** Najviše slika koje jedan uvoz preuzima; ostale se preskaču i mogu da se dodaju ponovnim uvozom. */
const MAX_IMPORT_IMAGES = 400;

/** Prvi korak: čita CSV i čuva ono što je pročitano, da ga vlasnik pregleda pre upisa. */
export async function startImportAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) backWithError(IMPORT_PATH, "Izaberite CSV fajl.");
  if (file.size > MAX_IMPORT_BYTES) backWithError(IMPORT_PATH, "Fajl je veći od 10 MB. Podelite ga na više manjih.");

  const settings = await getSettings();
  const parsed = parseImport(await file.text(), settings.store.currencyDecimals);
  if (!parsed) {
    backWithError(
      IMPORT_PATH,
      "Fajl nije prepoznat. Uvozi se CSV izvoz proizvoda iz Shopify-ja, WooCommerce-a ili ovog panela.",
    );
  }
  await setStoredValue(IMPORT_KEY, JSON.stringify({ ...parsed, fileName: file.name.slice(0, 120) }));
  redirect(IMPORT_PATH);
}

export async function cancelImportAction() {
  await requireAdmin();
  await setStoredValue(IMPORT_KEY, null);
  redirect(IMPORT_PATH);
}

/** Drugi korak: upisuje pročitane proizvode u katalog i, po izboru, preuzima njihove slike. */
export async function applyImportAction(formData: FormData) {
  await requireAdmin();
  const stored = await getStoredValue(IMPORT_KEY);
  if (!stored) backWithError(IMPORT_PATH, "Nema pročitanog fajla. Izaberite ga ponovo.");
  const pending = JSON.parse(stored) as ParsedImport;

  // Slike: adresa iz CSV-a → putanja ubačene slike. Slika koja je već u biblioteci (izvoz iz
  // ovog panela) se ne preuzima ponovo.
  const images = new Map<string, string>();
  let failed = 0;
  let skipped = 0;
  const urls = [...new Set(pending.products.flatMap((item) => item.images))];
  for (const url of urls) {
    const local = localMedia(url);
    if (local) {
      images.set(url, local);
      continue;
    }
    if (formData.get("images") !== "on") continue;
    if (images.size >= MAX_IMPORT_IMAGES) {
      skipped++;
      continue;
    }
    const bytes = await fetchImage(url);
    const owner = pending.products.find((item) => item.images.includes(url));
    const saved = bytes ? await saveImage(bytes, owner?.slug || "slika") : null;
    if (saved?.ok) images.set(url, saved.src);
    else failed++;
  }

  let stats = { created: 0, updated: 0, categories: 0 };
  await updateContent((content) => {
    stats = applyImport(content, pending.products, images);
  }, "Uvoz proizvoda");
  await setStoredValue(IMPORT_KEY, null);

  refreshSite();
  const notes = [
    `Uvezeno: novih proizvoda ${stats.created}, izmenjenih ${stats.updated}, novih kategorija ${stats.categories}.`,
    failed > 0 ? `Slika koje nisu preuzete: ${failed}.` : "",
    skipped > 0 ? `Preskočeno slika preko granice od ${MAX_IMPORT_IMAGES}: ${skipped}.` : "",
  ];
  redirect(`${IMPORT_PATH}?ok=${encodeURIComponent(notes.filter(Boolean).join(" "))}`);
}

/** Putanja slike iz biblioteke kada adresa pokazuje na sliku koja već postoji na ovom serveru. */
function localMedia(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const file = uploadPath(path);
    return file && existsSync(file) ? path : null;
  } catch {
    return null;
  }
}

/* ---------- Kolekcije ---------- */

const COLLECTIONS_PATH = `${ADMIN_PATH}/kolekcije`;

export async function createCollectionAction(formData: FormData) {
  await requireAdmin();

  const name = text(formData, "name");
  const id = uniqueSlug(
    name,
    (await getCollections()).map((collection) => collection.id),
  );
  if (!id) backWithError(COLLECTIONS_PATH, "Upišite naziv kolekcije.");

  await updateContent((content) => {
    content.collections.push({ id, name, description: "", productSlugs: [] });
  });
  refresh();
  redirect(`${COLLECTIONS_PATH}/${id}`);
}

export async function saveCollectionAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) backWithError(`${COLLECTIONS_PATH}/${id}`, "Upišite naziv kolekcije.");
  const chosen = formData.getAll("products").filter((value) => typeof value === "string");

  await updateContent((content) => {
    const collection = content.collections.find((candidate) => candidate.id === id);
    if (!collection) return;
    collection.name = name;
    collection.description = text(formData, "description");
    // Redosled u kolekciji prati redosled proizvoda u prodavnici.
    collection.productSlugs = content.products
      .map((product) => product.slug)
      .filter((slug) => chosen.includes(slug));
  });
  refresh();
  redirect(COLLECTIONS_PATH);
}

export async function deleteCollectionAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  await updateContent((content) => {
    content.collections = content.collections.filter((collection) => collection.id !== id);
  });
  refresh();
  redirect(COLLECTIONS_PATH);
}

/* ---------- Kategorije ---------- */

const CATEGORIES_PATH = `${ADMIN_PATH}/kategorije`;

export async function createCategoryAction(formData: FormData) {
  await requireAdmin();

  const categories = await getCategories();
  const label = text(formData, "label").slice(0, 255);
  const id = uniqueSlug(
    label,
    categories.map((category) => category.id),
  );
  if (!id) backWithError(CATEGORIES_PATH, "Upišite naziv kategorije.");
  const parent = text(formData, "parent");

  await updateContent((content) => {
    content.categories.push({
      id,
      label,
      parent: categories.some((category) => category.id === parent) ? parent : "",
      description: "",
      seoTitle: "",
      seoDescription: "",
    });
  });
  refreshSite();
  redirect(CATEGORIES_PATH);
}

export async function saveCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  const label = text(formData, "label").slice(0, 255);
  if (!label) backWithError(CATEGORIES_PATH, "Naziv kategorije ne može biti prazan.");
  const categories = await getCategories();
  const parent = text(formData, "parent");
  // Kategorija ne može biti pod sobom ni pod svojom podkategorijom: stablo bi dobilo petlju.
  if (parent !== "" && withDescendants(categories, id).includes(parent)) {
    backWithError(CATEGORIES_PATH, "Kategorija ne može biti podkategorija same sebe ili svoje podkategorije.");
  }

  await updateContent((content) => {
    const category = content.categories.find((candidate) => candidate.id === id);
    if (!category) return;
    Object.assign(category, {
      label,
      parent: content.categories.some((candidate) => candidate.id === parent) ? parent : "",
      description: text(formData, "description").slice(0, 2000),
      seoTitle: text(formData, "seoTitle").slice(0, 255),
      seoDescription: text(formData, "seoDescription").slice(0, 500),
    });
  });
  refreshSite();
  redirect(CATEGORIES_PATH);
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  const used = (await getProducts()).filter((product) => product.categories.includes(id)).length;
  if (used > 0) {
    backWithError(
      CATEGORIES_PATH,
      "Kategoriju još koriste proizvodi. Prebacite ih u drugu pa je onda obrišite.",
    );
  }
  await updateContent((content) => {
    const removed = content.categories.find((category) => category.id === id);
    content.categories = content.categories.filter((category) => category.id !== id);
    // Podkategorije obrisane kategorije prelaze pod njenu nadkategoriju.
    for (const category of content.categories) {
      if (category.parent === id) category.parent = removed?.parent ?? "";
    }
  });
  refreshSite();
  redirect(CATEGORIES_PATH);
}

/* ---------- Popusti ---------- */

const DISCOUNTS_PATH = `${ADMIN_PATH}/popusti`;

export async function saveDiscountAction(formData: FormData) {
  await requireAdmin();

  const [discounts, settings] = await Promise.all([getDiscounts(), getSettings()]);
  const editedId = text(formData, "id");
  const existing = discounts.find((discount) => discount.id === editedId);
  const formPath = existing ? `${DISCOUNTS_PATH}/${existing.id}` : `${DISCOUNTS_PATH}/novi`;
  if (editedId && !existing) backWithError(DISCOUNTS_PATH, "Popust više ne postoji.");

  const name = text(formData, "name");
  if (!name) backWithError(formPath, "Upišite naslov popusta.");
  const triggerValue = text(formData, "trigger");
  if (!(triggerValue in triggerLabels)) backWithError(formPath, "Izaberite vrstu popusta.");
  const trigger = triggerValue as DiscountTrigger;

  // Kod je obavezan za promo kod; kod nagrada bez njega svaki kupac dobija svoj, nasumičan.
  const code = normalizeCode(text(formData, "code"));
  if (trigger === "public" && code === "") {
    backWithError(formPath, "Promo kod mora imati upisan kod.");
  }
  if (code !== "" && !isValidCode(code)) {
    backWithError(formPath, "Kod može imati 3–32 znaka: slova bez kvačica, cifre i crticu.");
  }
  if (code !== "" && discounts.some((item) => item.code === code && item.id !== existing?.id)) {
    backWithError(formPath, "Taj kod već koristi drugi popust. Svaki popust mora imati svoj kod.");
  }
  const percent = Number(text(formData, "percent"));
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
    backWithError(formPath, "Popust je ceo broj od 1 do 100.");
  }

  // Prag: iznos za „amount" (u valuti prodavnice), grami za „weight"; ostali ga nemaju.
  let threshold = 0;
  if (trigger === "amount") {
    const amount = toMinor(text(formData, "threshold"), settings.store.currencyDecimals);
    if (amount === null || Number.isNaN(amount) || amount < 1) {
      backWithError(formPath, "Upišite iznos od kog se nagrada šalje.");
    }
    threshold = amount;
  } else if (trigger === "weight") {
    threshold = Number(text(formData, "threshold"));
    if (!Number.isInteger(threshold) || threshold < 1) {
      backWithError(formPath, "Upišite težinu u gramima od koje se nagrada šalje.");
    }
  }

  // Ograničenja važe samo za promo kod.
  let maxUses: number | null = null;
  let expiresAt: string | null = null;
  if (trigger === "public") {
    const uses = optionalCount(formData, "maxUses");
    if (uses === false || uses === 0) {
      backWithError(formPath, "Broj korišćenja je ceo broj veći od nule, ili prazno.");
    }
    maxUses = uses;
    const expires = text(formData, "expiresAt");
    if (expires !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
      backWithError(formPath, "Proverite datum do kog kod važi.");
    }
    expiresAt = expires || null;
  }

  const discount: Discount = {
    id:
      existing?.id ??
      (uniqueSlug(name, ["novi", ...discounts.map((item) => item.id)]) ||
        `popust-${Date.now().toString(36)}`),
    name,
    code,
    percent,
    status: text(formData, "status") === "active" ? "active" : "draft",
    trigger,
    threshold,
    maxUses,
    expiresAt,
  };
  await updateContent((content) => {
    content.discounts = existing
      ? content.discounts.map((item) => (item.id === discount.id ? discount : item))
      : [...content.discounts, discount];
  });
  redirect(DISCOUNTS_PATH);
}

/** Prebacuje popust između nacrta i aktivnog. */
export async function toggleDiscountAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  await updateContent((content) => {
    const discount = content.discounts.find((item) => item.id === id);
    if (discount) discount.status = discount.status === "active" ? "draft" : "active";
  });
  redirect(DISCOUNTS_PATH);
}

/** Briše pravilo. Kodovi koji su već poslati kupcima ostaju da važe. */
export async function deleteDiscountAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  await updateContent((content) => {
    content.discounts = content.discounts.filter((item) => item.id !== id);
  });
  redirect(DISCOUNTS_PATH);
}

/* ---------- Stranice ---------- */

const PAGES_PATH = `${ADMIN_PATH}/stranice`;

/** Izmena je vidljiva na sajtu odmah, i na stranicama koje su već otvorene u pregledaču. */
function refreshSite() {
  refresh();
  revalidatePath("/", "layout");
}

/** Nova stranica: naslov, pa se otvara uređivač. Adresa se pravi iz naslova i više se ne menja. */
export async function createPageAction(formData: FormData) {
  await requireAdmin();
  const formPath = `${PAGES_PATH}/nova`;

  const title = text(formData, "title").slice(0, 255);
  if (!title) backWithError(formPath, "Upišite naslov stranice.");
  const pages = await getPages();
  const slug = uniqueSlug(title, [...RESERVED_SLUGS, ...pages.map((page) => page.slug)]);
  if (!slug) backWithError(formPath, "Naslov mora da sadrži bar jedno slovo ili cifru.");

  const intro = newSection("intro", []);
  await updateContent((content) => {
    content.pages.push({
      slug,
      title,
      sections: intro ? [{ ...intro, data: { ...intro.data, title } }] : [],
      seoTitle: "",
      seoDescription: "",
      // Nova stranica je nacrt dok je vlasnik ne objavi.
      published: false,
      showInFooter: false,
    });
  });

  refresh();
  redirect(`${PAGES_PATH}/${slug}`);
}

export type SavePageInput = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
  showInFooter: boolean;
  sections: unknown;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Čuva stranicu iz uređivača. Sekcije stižu iz pregledača, pa se svode na opis polja. */
export async function savePageAction(input: SavePageInput): Promise<SaveResult> {
  await requireAdmin();

  const slug = typeof input?.slug === "string" ? input.slug : "";
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 255) : "";
  if (!title) return { ok: false, error: "Upišite naslov stranice." };
  if (!(await getPages()).some((page) => page.slug === slug)) {
    return { ok: false, error: "Stranica više ne postoji." };
  }

  const fields = {
    title,
    seoTitle: typeof input.seoTitle === "string" ? input.seoTitle.trim().slice(0, 255) : "",
    seoDescription:
      typeof input.seoDescription === "string" ? input.seoDescription.trim().slice(0, 500) : "",
    // Početna je uvek objavljena: bez nje sajt nema šta da prikaže.
    published: slug === HOME_SLUG || input.published === true,
    showInFooter: input.showInFooter === true,
    sections: normalizeSections(input.sections),
  };
  await updateContent((content) => {
    const page = content.pages.find((candidate) => candidate.slug === slug);
    if (page) Object.assign(page, fields);
  });
  await setStoredValue(PREVIEW_KEY, null);

  refreshSite();
  return { ok: true };
}

/** Deo podešavanja sajta koji uređuje Izgled sajta: tema, meni i podnožje, ili jedan šablon. */
export type SettingsPart =
  | { part: "theme"; value: unknown }
  | { part: "site"; value: unknown }
  | { part: "template"; id: string; value: unknown };

/** Podaci iz pregledača svedeni na ono što sme u podešavanja; null kada deo ne postoji. */
function settingsPart(input: SettingsPart): { kind: "settings"; settings: SettingsDraft } | null {
  const value = (typeof input?.value === "object" && input.value !== null ? input.value : {}) as Record<string, unknown>;
  if (input.part === "theme") {
    const colors = Object.fromEntries(
      (["background", "surface", "text", "accent"] as const).flatMap((key) =>
        // Boje idu pravo u CSS sajta i HTML emaila, pa prolazi samo oblik #rrggbb.
        isHexColor(value[key]) ? [[key, value[key].toLowerCase()]] : [],
      ),
    );
    const merged = mergeSettings({
      // Boja koja nije prošla proveru dobija početnu vrednost (mergeSettings).
      colors: colors as ThemeColors,
      fonts: {
        display: isFontId(value.fontDisplay) ? value.fontDisplay : defaultSettings.fonts.display,
        body: isFontId(value.fontBody) ? value.fontBody : defaultSettings.fonts.body,
      },
    });
    return { kind: "settings", settings: { colors: merged.colors, fonts: merged.fonts } };
  }
  if (input.part === "site") return { kind: "settings", settings: { site: mergeSite(value) } };
  const definition = template(input.id);
  if (!definition) return null;
  return {
    kind: "settings",
    settings: {
      templates: { [definition.id]: normalizeData(definition.fields, value) } as Partial<Templates>,
    },
  };
}

/**
 * Nesačuvane izmene iz uređivača koji je trenutno otvoren, za pregled na sajtu (?pregled=…).
 * Kupci ih ne vide: sajt se menja tek kada se izmene sačuvaju.
 */
export async function savePreviewAction(slug: string, sections: unknown): Promise<void> {
  await requireAdmin();
  if (!(await getPages()).some((page) => page.slug === slug)) return;
  const draft: PreviewDraft = { kind: "page", slug, sections: normalizeSections(sections) };
  await setStoredValue(PREVIEW_KEY, JSON.stringify(draft));
}

export async function saveSettingsPreviewAction(input: SettingsPart): Promise<void> {
  await requireAdmin();
  const draft = settingsPart(input);
  if (draft) await setStoredValue(PREVIEW_KEY, JSON.stringify(draft));
}

/** Čuva temu, meni i podnožje, ili tekstove jednog šablona. */
export async function saveSettingsPartAction(input: SettingsPart): Promise<SaveResult> {
  await requireAdmin();
  const draft = settingsPart(input);
  if (!draft) return { ok: false, error: "Ovaj deo sajta više ne postoji." };
  const { colors, fonts, site, templates } = draft.settings;
  await updateContent((content) => {
    if (input.part === "theme" && colors && fonts) Object.assign(content.settings, { colors, fonts });
    if (site) content.settings.site = site;
    if (templates) content.settings.templates = { ...content.settings.templates, ...templates };
  });
  await setStoredValue(PREVIEW_KEY, null);
  refreshSite();
  return { ok: true };
}

export async function deletePageAction(formData: FormData) {
  await requireAdmin();

  const slug = text(formData, "slug");
  if (slug === HOME_SLUG) backWithError(PAGES_PATH, "Početna strana ne može da se obriše.");
  await updateContent((content) => {
    content.pages = content.pages.filter((candidate) => candidate.slug !== slug);
  });
  await setStoredValue(PREVIEW_KEY, null);

  refreshSite();
  redirect(PAGES_PATH);
}

/* ---------- Slike ---------- */

const MEDIA_PATH = `${ADMIN_PATH}/slike`;

/** Slika ubačena iz uređivača; vraća putanju koja se upisuje u polje. */
export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  await requireAdmin();
  const file = image(formData, "image");
  if (!file) return { ok: false, error: "Izaberite sliku pre slanja." };
  const result = await saveUpload(file, "slika");
  if (result.ok) refresh();
  return result;
}

/** Više slika odjednom, sa stranice Slike. */
export async function uploadImagesAction(formData: FormData) {
  await requireAdmin();
  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) backWithError(MEDIA_PATH, "Izaberite bar jednu sliku.");
  for (const file of files) {
    const result = await saveUpload(file, "slika");
    if (!result.ok) backWithError(MEDIA_PATH, `${file.name}: ${result.error}`);
  }
  refresh();
  redirect(MEDIA_PATH);
}

export async function deleteImageAction(formData: FormData) {
  await requireAdmin();
  const src = text(formData, "src");
  if ((await getUsedImages()).has(src)) {
    backWithError(MEDIA_PATH, "Slika se koristi na sajtu. Prvo je zamenite tamo gde je prikazana.");
  }
  await removeUpload(src);
  refresh();
  redirect(MEDIA_PATH);
}

/* ---------- Porudžbine i kupci ---------- */

/** Adresa unutar panela na koju se vraća posle akcije; tuđe adrese se ne prihvataju. */
function returnPath(formData: FormData, fallback: string): string {
  const value = text(formData, "back");
  return value.startsWith(`${ADMIN_PATH}/`) ? value : fallback;
}

export async function setOrderStatusAction(formData: FormData) {
  await requireAdmin();

  const status = text(formData, "status");
  if (status in orderStatusLabels) {
    await setOrderStatus(text(formData, "number"), status as OrderStatus);
  }
  refresh();
  redirect(returnPath(formData, `${ADMIN_PATH}/porudzbine`));
}

export async function saveOrderNoteAction(formData: FormData) {
  await requireAdmin();

  await setOrderNote(text(formData, "number"), text(formData, "note").slice(0, 2000));
  redirect(returnPath(formData, `${ADMIN_PATH}/porudzbine`));
}

export async function saveCustomerNoteAction(formData: FormData) {
  await requireAdmin();

  const key = text(formData, "key");
  if (/^[A-Za-z0-9_-]{2,191}$/.test(key)) {
    await setCustomerNote(key, text(formData, "note").slice(0, 5000));
  }
  redirect(`${ADMIN_PATH}/kupci/${key}?ok=${encodeURIComponent("Beleška je sačuvana.")}`);
}

/* ---------- Poruke ---------- */

export async function deleteMessageAction(formData: FormData) {
  await requireAdmin();

  const id = wholeNumber(formData, "id");
  if (id !== null) await deleteMessage(id);
  redirect(`${ADMIN_PATH}/poruke`);
}

/* ---------- Podešavanja ---------- */

const SETTINGS_PATH = `${ADMIN_PATH}/podesavanja`;

function backWithNotice(message: string): never {
  redirect(`${SETTINGS_PATH}?ok=${encodeURIComponent(message)}`);
}

function emailAddress(formData: FormData, name: string, label: string): string {
  const value = text(formData, name);
  if (value !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    backWithError(SETTINGS_PATH, `Proverite adresu u polju „${label}".`);
  }
  return value;
}

export async function saveStoreAction(formData: FormData) {
  await requireAdmin();

  const name = text(formData, "name");
  if (!name) backWithError(SETTINGS_PATH, "Upišite naziv prodavnice.");
  const currency = text(formData, "currency");
  if (!currency || currency.length > 8) {
    backWithError(SETTINGS_PATH, "Upišite oznaku valute, npr. RSD ili €.");
  }

  // Jezik i zona idu pravo u zapis datuma; neispravna vrednost bi srušila svaku stranicu panela.
  const locale = text(formData, "locale") || defaultSettings.store.locale;
  const timeZone = text(formData, "timeZone") || defaultSettings.store.timeZone;
  try {
    new Intl.DateTimeFormat(locale, { timeZone }).format(new Date());
  } catch {
    backWithError(
      SETTINGS_PATH,
      "Proverite jezik (npr. sr-Latn-RS) i vremensku zonu (npr. Europe/Belgrade).",
    );
  }

  const origins = text(formData, "allowedOrigins");
  for (const origin of origins.split(/[\s,]+/).filter(Boolean)) {
    if (!/^https?:\/\/[^/\s]+\/?$/.test(origin)) {
      backWithError(
        SETTINGS_PATH,
        `Adresa sajta „${origin}" nije ispravna. Upisuje se u obliku https://mojsajt.rs, bez putanje.`,
      );
    }
  }
  const storefrontUrl = text(formData, "storefrontUrl");
  if (storefrontUrl !== "" && !/^https?:\/\//.test(storefrontUrl)) {
    backWithError(SETTINGS_PATH, "Adresa sajta počinje sa https:// ili http://.");
  }

  const email = emailAddress(formData, "email", "Email prodavnice");
  await updateContent((content) => {
    content.settings.store = {
      name,
      phone: text(formData, "phone"),
      email,
      address: text(formData, "address"),
      currency,
      currencyDecimals: text(formData, "currencyDecimals") === "2" ? 2 : 0,
      locale,
      timeZone,
      phonePrefix: text(formData, "phonePrefix").replace(/\D/g, ""),
      codePrefix: text(formData, "codePrefix")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 12),
      storefrontUrl,
      allowedOrigins: origins,
    };
  });
  refresh();
  backWithNotice("Podaci o prodavnici su sačuvani.");
}

export async function saveAppearanceAction(formData: FormData) {
  await requireAdmin();
  const current = await getSettings();

  // Slike: nova zamenjuje staru; „Ukloni" je briše.
  const images = { logo: current.logo, favicon: current.favicon };
  const replaced: (string | undefined)[] = [];
  for (const key of ["logo", "favicon"] as const) {
    const file = image(formData, key);
    if (file) {
      const upload = await saveUpload(file, key, { original: true });
      if (!upload.ok) backWithError(SETTINGS_PATH, upload.error);
      replaced.push(images[key]);
      images[key] = upload.src;
    } else if (formData.get(`${key}Remove`) === "on") {
      replaced.push(images[key]);
      images[key] = undefined;
    }
  }

  await updateContent((content) => {
    content.settings = { ...content.settings, ...images };
  });
  for (const src of replaced) await removeUpload(src);

  refresh();
  backWithNotice("Logo i favicon su sačuvani.");
}

export async function saveShippingAction(formData: FormData) {
  await requireAdmin();

  const decimals = (await getSettings()).store.currencyDecimals;
  const price = toMinor(text(formData, "price"), decimals) ?? 0;
  const freeFrom = toMinor(text(formData, "freeFrom"), decimals) ?? 0;
  if (Number.isNaN(price) || Number.isNaN(freeFrom)) {
    backWithError(SETTINGS_PATH, "Iznosi dostave su brojevi, npr. 450 ili 4,50.");
  }
  const freeEnabled = formData.get("freeEnabled") === "on";
  if (freeEnabled && freeFrom < 1) {
    backWithError(SETTINGS_PATH, "Upišite iznos od kog je dostava besplatna.");
  }
  const pickupEnabled = formData.get("pickupEnabled") === "on";
  await updateContent((content) => {
    content.settings.shipping = { price, freeEnabled, freeFrom, pickupEnabled };
  });
  backWithNotice("Dostava je sačuvana.");
}

export async function savePaymentAction(formData: FormData) {
  await requireAdmin();

  const cod = formData.get("cod") === "on";
  const bank = formData.get("bank") === "on";
  const bankInstructions = text(formData, "bankInstructions").slice(0, 2000);
  if (!cod && !bank) backWithError(SETTINGS_PATH, "Bar jedan način plaćanja mora biti uključen.");
  if (bank && bankInstructions === "") {
    backWithError(SETTINGS_PATH, "Za uplatu na račun upišite podatke za uplatu.");
  }
  await updateContent((content) => {
    content.settings.payment = { cod, bank, bankInstructions };
  });
  backWithNotice("Načini plaćanja su sačuvani.");
}

export async function saveMailAction(formData: FormData) {
  await requireAdmin();

  const sellerEmail = emailAddress(formData, "sellerEmail", "Vaš email");
  const fromEmail = emailAddress(formData, "fromEmail", "Adresa pošiljaoca");
  const port = Number(text(formData, "smtpPort"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    backWithError(SETTINGS_PATH, "Port je broj, najčešće 587 ili 465.");
  }
  const password = formData.get("smtpPassword");

  await updateContent((content) => {
    const { mail } = content.settings;
    content.settings.mail = {
      ...mail,
      notifySeller: formData.get("notifySeller") === "on",
      notifyCustomer: formData.get("notifyCustomer") === "on",
      sellerEmail,
      fromName: text(formData, "fromName"),
      fromEmail,
      smtpHost: text(formData, "smtpHost"),
      smtpPort: port,
      smtpUser: text(formData, "smtpUser"),
      // Lozinka se ne prikazuje u formi; prazno polje znači „ostaje ista".
      smtpPassword: typeof password === "string" && password !== "" ? password : mail.smtpPassword,
    };
  });
  backWithNotice("Podešavanja emaila su sačuvana.");
}

export async function uploadTemplateAction(formData: FormData) {
  await requireAdmin();

  const file = formData.get("template");
  if (!(file instanceof File) || file.size === 0) {
    backWithError(SETTINGS_PATH, "Izaberite HTML fajl sa šablonom.");
  }
  if (file.size > MAX_TEMPLATE_BYTES) backWithError(SETTINGS_PATH, "Šablon je veći od 300 KB.");
  const html = await file.text();
  if (!html.includes("<") || !html.includes("{{")) {
    backWithError(
      SETTINGS_PATH,
      "Fajl ne liči na šablon: treba da bude HTML sa mestima poput {{stavke}} i {{ukupno}}.",
    );
  }

  await saveCustomTemplate(html);
  await updateContent((content) => {
    content.settings.mail.customTemplate = true;
  });
  backWithNotice("Vaš šablon je ubačen. Pogledajte pregled pre nego što stigne prva porudžbina.");
}

export async function resetTemplateAction() {
  await requireAdmin();

  await updateContent((content) => {
    content.settings.mail.customTemplate = false;
  });
  await removeCustomTemplate();
  backWithNotice("Koristi se naš šablon.");
}

export async function sendTestEmailAction() {
  await requireAdmin();

  const error = await sendTestEmail();
  if (error) backWithError(SETTINGS_PATH, `Probni email nije poslat — ${error}`);
  backWithNotice(
    "Probni email je poslat na vašu adresu: jedna poruka kakvu dobijate vi, jedna kakvu dobija kupac.",
  );
}
