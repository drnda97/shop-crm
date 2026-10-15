"use server";

import { shopT } from "@/lib/i18n/server";
import { saveTranslations } from "@/lib/translations";
import { renamePage, translateContent } from "@/lib/i18n/content";
import { isLang, langCode, type Lang } from "@/lib/i18n";
import { existsSync } from "node:fs";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_PATH,
  createSession,
  destroySession,
  requireAdmin,
  verifyLogin,
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
  type DiscountKind,
  type DiscountTrigger,
} from "@/lib/discounts";
import { formatMoney, MAX_MINOR, toMinor } from "@/lib/format";
import {
  MAX_TEMPLATE_BYTES,
  notifyStatus,
  removeCustomTemplate,
  saveCustomTemplate,
  sendTestEmail,
} from "@/lib/order-email";
import {
  addOrderEvent,
  getOrder,
  refundOrder,
  setOrderCustomer,
  setOrderNote,
  setOrderPaid,
  setOrderStatus,
  setOrderTracking,
  submitOrder,
} from "@/lib/order-store";
import { getDb } from "@/lib/db";
import { customerKey, orderStatusLabels, refundable, validateCustomer, type OrderStatus } from "@/lib/orders";
import { applyImport, parseImport, type ParsedImport } from "@/lib/product-import";
import { clientIp, TOO_MANY, tooMany } from "@/lib/rate-limit";
import { fetchImage } from "@/lib/remote-image";
import { newSection, normalizeData, normalizeSections } from "@/lib/sections";
import { findProvider } from "@/lib/payments";
import { currencyOf, defaultSettings, INVOICE_EMAILS, mergeSettings, PRODUCTS_PER_PAGE, productsPerPage, STATUS_EMAILS,
  storeLanguages,
} from "@/lib/settings";
import { THEME_LIST } from "@/themes/list";
import { normalizeMethods } from "@/lib/shipping";
import { sendDueReminders } from "@/lib/abandoned";
import { audit } from "@/lib/audit";
import { isMailReady, linkBase, NO_SITE_URL, sendMails, simpleEmail } from "@/lib/mail";
import { createCampaign, getRecipients, sendCampaign } from "@/lib/newsletter";
import { eraseCustomer } from "@/lib/privacy";
import { resolveReturn } from "@/lib/returns";
import { deleteReview, setReviewStatus } from "@/lib/reviews";
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
  return Number.isFinite(value) && value > 0 && value <= MAX_MINOR ? Math.round(value) : null;
}

/** Broj komada iz forme: null kada je polje prazno, false kada nije ceo broj od nule naviše. */
function optionalCount(formData: FormData, name: string): number | null | false {
  const value = text(formData, name);
  if (value === "") return null;
  // Samo cifre: Number bi primio i 1e3 i 0x10. Gornja granica je kolona INT u bazi.
  const count = /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(count) && count <= MAX_MINOR ? count : false;
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
  redirect(`${path}${path.includes("?") ? "&" : "?"}greska=${encodeURIComponent(message)}`);
}

/**
 * Strana spiska proizvoda sa koje je akcija pokrenuta (polje "back": ?strana=, ?q=), da se
 * posle izmene stanja ili redosleda ostane na istoj strani. Prihvata samo adresu spiska.
 */
function productsBack(formData: FormData): string {
  const value = text(formData, "back");
  return /^\/admin\/proizvodi\?[\w=&%+.*-]*$/.test(value) ? value : PRODUCTS_PATH;
}

/** Stranice panela već otvorene u pregledaču dobijaju svež sadržaj pri sledećem prelasku. */
function refresh() {
  revalidatePath(ADMIN_PATH, "layout");
}

/* ---------- Prijava ---------- */

export type LoginState = {
  error?: string;
  /** Lozinka je ispravna, a korisnik ima prijavu u dva koraka: forma traži kod iz aplikacije. */
  needCode?: boolean;
};

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const ip = clientIp(await headers());
  if (tooMany("admin-login", ip, 10)) return { error: TOO_MANY };
  // Brojač po nalogu ne zavisi od adrese, pa ga promena zaglavlja ne zaobilazi; pokriva i
  // nagađanje koda iz aplikacije, jer svaki pokušaj koda ponovo šalje ime i lozinku.
  const username = text(formData, "username");
  if (tooMany("admin-login-user", username.toLowerCase(), 10)) return { error: TOO_MANY };
  const result = await verifyLogin(username, text(formData, "password"), text(formData, "code"));
  if (!result.ok) {
    if (result.reason === "code-needed") return { needCode: true };
    await audit(
      result.reason === "code-invalid" ? "Neuspela prijava: pogrešan kod" : "Neuspela prijava: pogrešno ime ili lozinka",
      `${username.slice(0, 100)} · ${ip}`,
    );
    // Usporava nagađanje lozinke i koda.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return result.reason === "code-invalid"
      ? { needCode: true, error: "Kod nije ispravan. Upišite trenutni kod iz aplikacije ili rezervni kod." }
      : { error: "Pogrešno korisničko ime ili lozinka." };
  }
  await createSession(result.user.id);
  await audit("Prijava u panel", undefined, result.user);
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
  await requireAdmin("catalog");

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
  await audit("Sačuvan proizvod", formData);
  redirect(PRODUCTS_PATH);
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin("catalog");

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
  await audit("Obrisan proizvod", formData);
  redirect(productsBack(formData));
}

/** Brza izmena stanja iz spiska proizvoda: klik menja ručno stanje, a broj se upisuje direktno. */
export async function setStockAction(formData: FormData) {
  await requireAdmin("catalog");

  const slug = text(formData, "slug");
  const stockQty = formData.has("stockQty") ? optionalCount(formData, "stockQty") : undefined;
  if (stockQty === false)
    backWithError(productsBack(formData), "Broj komada na stanju je ceo broj, nula ili više.");

  await updateContent((content) => {
    const product = content.products.find((item) => item.slug === slug);
    if (!product) return;
    if (stockQty === undefined) product.inStock = !product.inStock;
    else product.stockQty = stockQty;
  });
  refresh();
  await audit("Promenjeno stanje proizvoda", formData);
  redirect(productsBack(formData));
}

/** Pomera proizvod za jedno mesto gore ili dole; tim redom ih API vraća sajtu. */
export async function moveProductAction(formData: FormData) {
  await requireAdmin("catalog");

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
  redirect(productsBack(formData));
}

/** Koliko proizvoda staje na jednu stranu spiska; važi za sve korisnike panela. */
export async function saveProductsPerPageAction(formData: FormData) {
  await requireAdmin("catalog");
  const value = Number(text(formData, "perPage"));
  if (!Number.isInteger(value) || value < PRODUCTS_PER_PAGE.min || value > PRODUCTS_PER_PAGE.max) {
    backWithError(productsBack(formData), "Broj proizvoda po strani je od 5 do 200.");
  }
  await updateContent((content) => {
    content.settings.panel = { ...content.settings.panel, productsPerPage: productsPerPage(value) };
  });
  refresh();
  await audit("Promenjen broj proizvoda po strani", String(value));
  // Sa drugim brojem po strani stare strane ne odgovaraju, pa se kreće od prve (pretraga ostaje).
  const q = new URLSearchParams(productsBack(formData).split("?")[1] ?? "").get("q");
  redirect(q ? `${PRODUCTS_PATH}?q=${encodeURIComponent(q)}` : PRODUCTS_PATH);
}

/* ---------- Više proizvoda odjednom ---------- */

/** Ista izmena na svim označenim proizvodima iz spiska. */
export async function bulkProductsAction(formData: FormData) {
  await requireAdmin("catalog");

  const slugs = formData.getAll("slugs").filter((value): value is string => typeof value === "string");
  if (slugs.length === 0) backWithError(productsBack(formData), "Označite bar jedan proizvod.");
  const operation = text(formData, "operation");
  const category = text(formData, "category");
  const percent = Number(text(formData, "percent").replace(",", "."));
  const categories = await getCategories();

  if ((operation === "addCategory" || operation === "removeCategory") && !categories.some((item) => item.id === category)) {
    backWithError(productsBack(formData), "Izaberite kategoriju.");
  }
  if (operation === "price" && (!Number.isFinite(percent) || percent === 0 || percent <= -100 || percent > 1000)) {
    backWithError(productsBack(formData), "Upišite procenat promene cene, npr. 10 ili -15.");
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
  await audit("Izmenjeno više proizvoda", formData);
  redirect(productsBack(formData));
}

/* ---------- Uvoz proizvoda ---------- */

const IMPORT_PATH = `${PRODUCTS_PATH}/uvoz`;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
/** Najviše slika koje jedan uvoz preuzima; ostale se preskaču i mogu da se dodaju ponovnim uvozom. */
const MAX_IMPORT_IMAGES = 400;

/** Prvi korak: čita CSV i čuva ono što je pročitano, da ga vlasnik pregleda pre upisa. */
export async function startImportAction(formData: FormData) {
  await requireAdmin("catalog");
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
  await requireAdmin("catalog");
  await setStoredValue(IMPORT_KEY, null);
  redirect(IMPORT_PATH);
}

/** Drugi korak: upisuje pročitane proizvode u katalog i, po izboru, preuzima njihove slike. */
export async function applyImportAction(formData: FormData) {
  await requireAdmin("catalog");
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
  await audit("Uvezeni proizvodi", `novih ${stats.created}, izmenjenih ${stats.updated}`);
  redirect(`${IMPORT_PATH}?ok=${encodeURIComponent(notes.filter(Boolean).join(" "))}`);
}

/**
 * Putanja slike iz biblioteke kada adresa pokazuje na sliku koja već postoji na ovom serveru.
 * Izvoz bez upisane adrese sajta daje adresu bez domena („/media/…"), pa i nju prepoznaje.
 */
function localMedia(url: string): string | null {
  try {
    const path = new URL(url, "http://localhost").pathname;
    const file = uploadPath(path);
    return file && existsSync(file) ? path : null;
  } catch {
    return null;
  }
}

/* ---------- Kolekcije ---------- */

const COLLECTIONS_PATH = `${ADMIN_PATH}/kolekcije`;

export async function createCollectionAction(formData: FormData) {
  await requireAdmin("catalog");

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
  await audit("Napravljena kolekcija", formData);
  redirect(`${COLLECTIONS_PATH}/${id}`);
}

export async function saveCollectionAction(formData: FormData) {
  await requireAdmin("catalog");

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
  await audit("Sačuvana kolekcija", formData);
  redirect(COLLECTIONS_PATH);
}

export async function deleteCollectionAction(formData: FormData) {
  await requireAdmin("catalog");

  const id = text(formData, "id");
  await updateContent((content) => {
    content.collections = content.collections.filter((collection) => collection.id !== id);
  });
  refresh();
  await audit("Obrisana kolekcija", formData);
  redirect(COLLECTIONS_PATH);
}

/* ---------- Kategorije ---------- */

const CATEGORIES_PATH = `${ADMIN_PATH}/kategorije`;

export async function createCategoryAction(formData: FormData) {
  await requireAdmin("catalog");

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
  await audit("Napravljena kategorija", formData);
  redirect(CATEGORIES_PATH);
}

export async function saveCategoryAction(formData: FormData) {
  await requireAdmin("catalog");

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
  await audit("Sačuvana kategorija", formData);
  redirect(CATEGORIES_PATH);
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin("catalog");

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
  await audit("Obrisana kategorija", formData);
  redirect(CATEGORIES_PATH);
}

/* ---------- Popusti ---------- */

const DISCOUNTS_PATH = `${ADMIN_PATH}/popusti`;

export async function saveDiscountAction(formData: FormData) {
  await requireAdmin("discounts");

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
  // Promo kod i automatski popust biraju šta daju; nagrade su uvek procenat na celu korpu.
  const cartDiscount = trigger === "public" || trigger === "auto";
  const kindValue = text(formData, "kind");
  const kind: DiscountKind = cartDiscount && (kindValue === "amount" || kindValue === "shipping") ? kindValue : "percent";
  const decimals = settings.store.currencyDecimals;

  let percent = 0;
  let amount = 0;
  if (kind === "percent") {
    percent = Number(text(formData, "percent"));
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
      backWithError(formPath, "Popust je ceo broj od 1 do 100.");
    }
  } else if (kind === "amount") {
    const value = toMinor(text(formData, "amount"), decimals);
    if (value === null || Number.isNaN(value) || value < 1) {
      backWithError(formPath, "Upišite iznos popusta.");
    }
    amount = value;
  }

  // Prag: najmanji iznos korpe za promo kod i automatski popust; iznos za „amount" i grami za
  // „weight" kod nagrada.
  let threshold = 0;
  if (trigger === "weight") {
    threshold = Number(text(formData, "threshold"));
    if (!Number.isInteger(threshold) || threshold < 1) {
      backWithError(formPath, "Upišite težinu u gramima od koje se nagrada šalje.");
    }
  } else if (trigger !== "first") {
    const value = toMinor(text(formData, "threshold"), decimals);
    if (Number.isNaN(value) || (trigger === "amount" && (value === null || value < 1))) {
      backWithError(formPath, trigger === "amount" ? "Upišite iznos od kog se nagrada šalje." : "Najmanji iznos korpe je broj, npr. 5000.");
    }
    threshold = value ?? 0;
  }

  // Ograničenja i izbor proizvoda važe samo za promo kod i automatski popust.
  let maxUses: number | null = null;
  let expiresAt: string | null = null;
  let scopeProducts: string[] = [];
  let scopeCategories: string[] = [];
  if (cartDiscount) {
    const uses = optionalCount(formData, "maxUses");
    if (uses === false || uses === 0) {
      backWithError(formPath, "Broj korišćenja je ceo broj veći od nule, ili prazno.");
    }
    maxUses = uses;
    const expires = text(formData, "expiresAt");
    if (expires !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
      backWithError(formPath, "Proverite datum do kog popust važi.");
    }
    expiresAt = expires || null;
    if (kind !== "shipping") {
      const [products, categories] = await Promise.all([getProducts(), getCategories()]);
      const picked = (name: string) => formData.getAll(name).filter((value): value is string => typeof value === "string");
      scopeProducts = picked("products").filter((slug) => products.some((product) => product.slug === slug));
      scopeCategories = picked("categories").filter((id) => categories.some((category) => category.id === id));
    }
  }

  const discount: Discount = {
    id:
      existing?.id ??
      (uniqueSlug(name, ["novi", ...discounts.map((item) => item.id)]) ||
        `popust-${Date.now().toString(36)}`),
    name,
    code: trigger === "auto" ? "" : code,
    kind,
    percent,
    amount,
    products: scopeProducts,
    categories: scopeCategories,
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
  refreshSite();
  await audit("Sačuvan popust", formData);
  redirect(DISCOUNTS_PATH);
}

/** Prebacuje popust između nacrta i aktivnog. */
export async function toggleDiscountAction(formData: FormData) {
  await requireAdmin("discounts");

  const id = text(formData, "id");
  await updateContent((content) => {
    const discount = content.discounts.find((item) => item.id === id);
    if (discount) discount.status = discount.status === "active" ? "draft" : "active";
  });
  await audit("Uključen ili isključen popust", formData);
  redirect(DISCOUNTS_PATH);
}

/** Briše pravilo. Kodovi koji su već poslati kupcima ostaju da važe. */
export async function deleteDiscountAction(formData: FormData) {
  await requireAdmin("discounts");

  const id = text(formData, "id");
  await updateContent((content) => {
    content.discounts = content.discounts.filter((item) => item.id !== id);
  });
  await audit("Obrisan popust", formData);
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
  await requireAdmin("content");
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
  await audit("Napravljena stranica", formData);
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
  await requireAdmin("content");

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
  await audit("Sačuvana stranica", input.slug);
  return { ok: true };
}

/** Čuva prevode sa stranice Prevodi: parovi izvorni tekst → prevod za jedan jezik. */
export async function saveTranslationsAction(formData: FormData) {
  await requireAdmin("content");
  const settings = await getSettings();
  const lang = text(formData, "lang");
  const backTo = text(formData, "back");
  const path = backTo.startsWith(`${ADMIN_PATH}/prevodi`) ? backTo : `${ADMIN_PATH}/prevodi`;
  if (!settings.store.languages.includes(lang)) backWithError(`${ADMIN_PATH}/prevodi`, "Taj jezik nije među jezicima sajta.");
  const sources = formData.getAll("source");
  const values = formData.getAll("value");
  const entries = sources.flatMap((source, index) =>
    typeof source === "string" && typeof values[index] === "string" ? [{ source, value: (values[index] as string).slice(0, 20000) }] : [],
  );
  await saveTranslations(lang, entries);
  refreshSite();
  await audit("Sačuvani prevodi", `${lang}: ${entries.filter((entry) => entry.value.trim() !== "").length}`);
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent("Prevodi su sačuvani.")}`);
}

/** Menja adresu stranice na sajtu (/o-nama → /about) i ispravlja linkove ka njoj u meniju, podnožju i sekcijama. */
export async function renamePageAction(formData: FormData) {
  await requireAdmin("content");
  const slug = text(formData, "slug");
  const next = slugify(text(formData, "newSlug"));
  const formPath = `${PAGES_PATH}/${slug}`;
  if (!next) backWithError(formPath, "Adresa mora da sadrži bar jedno slovo ili cifru.");
  if (slug === HOME_SLUG) backWithError(formPath, "Početna strana je uvek na adresi sajta.");
  let renamed = false;
  await updateContent((content) => {
    renamed = renamePage(content, slug, next);
  });
  if (!renamed) backWithError(formPath, "Ta adresa je zauzeta: koristi je druga stranica ili sama prodavnica.");
  await setStoredValue(PREVIEW_KEY, null);
  refreshSite();
  await audit("Promenjena adresa stranice", `/${slug} → /${next}`);
  redirect(`${PAGES_PATH}/${next}`);
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
  await requireAdmin("content");
  if (!(await getPages()).some((page) => page.slug === slug)) return;
  const draft: PreviewDraft = { kind: "page", slug, sections: normalizeSections(sections) };
  await setStoredValue(PREVIEW_KEY, JSON.stringify(draft));
}

export async function saveSettingsPreviewAction(input: SettingsPart): Promise<void> {
  await requireAdmin("content");
  const draft = settingsPart(input);
  if (draft) await setStoredValue(PREVIEW_KEY, JSON.stringify(draft));
}

/** Čuva temu, meni i podnožje, ili tekstove jednog šablona. */
export async function saveSettingsPartAction(input: SettingsPart): Promise<SaveResult> {
  await requireAdmin("content");
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
  await audit("Sačuvan izgled sajta", input.part === "template" ? `tekstovi: ${input.id}` : input.part === "theme" ? "tema" : "meni i podnožje");
  return { ok: true };
}

export async function deletePageAction(formData: FormData) {
  await requireAdmin("content");

  const slug = text(formData, "slug");
  if (slug === HOME_SLUG) backWithError(PAGES_PATH, "Početna strana ne može da se obriše.");
  await updateContent((content) => {
    content.pages = content.pages.filter((candidate) => candidate.slug !== slug);
  });
  await setStoredValue(PREVIEW_KEY, null);

  refreshSite();
  await audit("Obrisana stranica", formData);
  redirect(PAGES_PATH);
}

/* ---------- Slike ---------- */

const MEDIA_PATH = `${ADMIN_PATH}/slike`;

/** Slika ubačena iz uređivača; vraća putanju koja se upisuje u polje. */
export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  await requireAdmin("content");
  const file = image(formData, "image");
  if (!file) return { ok: false, error: "Izaberite sliku pre slanja." };
  const result = await saveUpload(file, "slika");
  if (result.ok) refresh();
  return result;
}

/** Više slika odjednom, sa stranice Slike. */
export async function uploadImagesAction(formData: FormData) {
  await requireAdmin("content");
  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) backWithError(MEDIA_PATH, "Izaberite bar jednu sliku.");
  for (const file of files) {
    const result = await saveUpload(file, "slika");
    if (!result.ok) backWithError(MEDIA_PATH, `${file.name}: ${result.error}`);
  }
  refresh();
  await audit("Ubačene slike", formData);
  redirect(MEDIA_PATH);
}

export async function deleteImageAction(formData: FormData) {
  await requireAdmin("content");
  const src = text(formData, "src");
  if ((await getUsedImages()).has(src)) {
    backWithError(MEDIA_PATH, "Slika se koristi na sajtu. Prvo je zamenite tamo gde je prikazana.");
  }
  await removeUpload(src);
  refresh();
  await audit("Obrisana slika", formData);
  redirect(MEDIA_PATH);
}

/* ---------- Porudžbine i kupci ---------- */

/** Adresa unutar panela na koju se vraća posle akcije; tuđe adrese se ne prihvataju. */
function returnPath(formData: FormData, fallback: string): string {
  const value = text(formData, "back");
  return value.startsWith(`${ADMIN_PATH}/`) ? value : fallback;
}

export async function setOrderStatusAction(formData: FormData) {
  await requireAdmin("orders");

  const number = text(formData, "number");
  const status = text(formData, "status");
  if (status in orderStatusLabels) {
    await setOrderStatus(number, status as OrderStatus);
    // Email kupcu o novom statusu ide pošto panel dobije odgovor; ishod se upisuje u istoriju porudžbine.
    after(async () => {
      const order = await getOrder(number);
      if (!order || order.status !== status) return;
      const outcome = await notifyStatus(order).catch((reason) => String(reason));
      if (outcome === "skipped") return;
      await addOrderEvent(
        await getDb(),
        number,
        outcome === "sent" ? `Kupcu je poslat email: ${orderStatusLabels[order.status].toLowerCase()}` : `Email kupcu nije poslat: ${outcome}`,
      );
    });
  }
  refresh();
  await audit("Promenjen status porudžbine", formData);
  redirect(returnPath(formData, `${ADMIN_PATH}/porudzbine`));
}

const orderPath = (number: string) => `${ADMIN_PATH}/porudzbine/${number}`;

export async function saveTrackingAction(formData: FormData) {
  await requireAdmin("orders");
  const number = text(formData, "number");
  const url = text(formData, "trackingUrl").slice(0, 500);
  if (url !== "" && !/^https?:\/\//.test(url)) {
    backWithError(orderPath(number), "Adresa za praćenje počinje sa https:// ili http://.");
  }
  await setOrderTracking(number, { number: text(formData, "trackingNumber").slice(0, 100), url });
  refresh();
  await audit("Upisan broj pošiljke", formData);
  redirect(orderPath(number));
}

export async function setOrderPaidAction(formData: FormData) {
  await requireAdmin("orders");
  const number = text(formData, "number");
  const paid = text(formData, "paid") === "yes";
  await setOrderPaid(number, paid, paid ? "Označeno kao plaćeno" : "Oznaka plaćeno je uklonjena");
  refresh();
  await audit("Promenjena oznaka plaćeno", formData);
  redirect(orderPath(number));
}

/** Evidencija povraćaja: iznos se upisuje uz porudžbinu i oduzima od prodaje. Novac vraća prodavac. */
export async function refundOrderAction(formData: FormData) {
  await requireAdmin("orders");
  const number = text(formData, "number");
  const [order, settings] = await Promise.all([getOrder(number), getSettings()]);
  if (!order) backWithError(`${ADMIN_PATH}/porudzbine`, "Porudžbina više ne postoji.");
  const amount = toMinor(text(formData, "amount"), settings.store.currencyDecimals);
  if (amount === null || Number.isNaN(amount) || amount < 1) {
    backWithError(orderPath(number), "Upišite iznos povraćaja.");
  }
  if (amount > refundable(order)) {
    backWithError(orderPath(number), `Najviše može da se vrati ${formatMoney(refundable(order), currencyOf(settings))}.`);
  }
  const reason = text(formData, "reason").slice(0, 300);
  // Vraćeni komadi po stavci: polja returned-0, returned-1… iz forme.
  const returns = order.items.flatMap((item, position) => {
    const qty = Math.round(Number(text(formData, `returned-${position}`)) || 0);
    return qty > 0 ? [{ position, qty: Math.min(qty, item.qty - item.returned) }] : [];
  });
  const label = formatMoney(amount, currencyOf(settings));

  // Kartica: ako procesor ume, novac se vraća preko njega; inače ga prodavac vraća sam.
  const provider = order.paymentMethod === "card" && order.paymentRef ? findProvider(settings.payment.cardProvider) : undefined;
  let how = "";
  if (provider?.refund && provider.ready()) {
    const sent = await provider.refund(order.paymentRef as string, amount);
    if (!sent.ok) backWithError(orderPath(number), `Procesor kartica nije prihvatio povraćaj: ${sent.error}`);
    how = ` (vraćeno na karticu, ${provider.label})`;
  }

  const done = await refundOrder(number, amount, `Povraćaj ${label}${how}${reason ? `: ${reason}` : ""}`, returns);
  if (!done) backWithError(orderPath(number), "Povraćaj nije upisan: iznos prelazi ono što je ostalo da se vrati.");

  after(async () => {
    const fresh = await getOrder(number);
    if (!fresh) return;
    const outcome = await notifyStatus(fresh, "refunded", { iznos: label }).catch((cause) => String(cause));
    if (outcome === "skipped") return;
    await addOrderEvent(await getDb(), number, outcome === "sent" ? "Kupcu je poslat email o povraćaju" : `Email o povraćaju nije poslat: ${outcome}`);
  });
  refresh();
  await audit("Upisan povraćaj", formData);
  redirect(orderPath(number));
}

export async function saveOrderCustomerAction(formData: FormData) {
  await requireAdmin("orders");
  const number = text(formData, "number");
  const customer = {
    name: text(formData, "name").slice(0, 255),
    phone: text(formData, "phone").slice(0, 64),
    email: text(formData, "email").slice(0, 255),
    street: text(formData, "street").slice(0, 255),
    city: text(formData, "city").slice(0, 255),
    postalCode: text(formData, "postalCode").slice(0, 16),
    note: text(formData, "note").slice(0, 500),
  };
  const errors = Object.values(validateCustomer(customer));
  if (errors.length > 0) backWithError(orderPath(number), errors[0]);
  const settings = await getSettings();
  await setOrderCustomer(number, customer, customerKey(customer, settings.store.phonePrefix));
  refresh();
  await audit("Izmenjeni podaci kupca na porudžbini", formData);
  redirect(orderPath(number));
}

export type ManualOrderResult = { ok: true; number: string } | { ok: false; error: string };

/** Porudžbina uneta u panelu (telefonom, u radnji): prolazi iste provere kao porudžbina sa sajta. */
export async function createManualOrderAction(input: unknown): Promise<ManualOrderResult> {
  await requireAdmin("orders");
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  // Kartica traži kupca na stranici procesora, pa se ručno unose samo pouzeće i uplata na račun.
  if (raw.paymentMethod === "card") return { ok: false, error: "Ručna porudžbina se ne plaća karticom." };
  const result = await submitOrder(raw, "Uneta ručno u panelu");
  if (!result.ok) return { ok: false, error: result.message ?? Object.values(result.errors)[0] ?? "Proverite podatke." };
  refresh();
  await audit("Ručno uneta porudžbina", `#${result.orderNumber}`);
  return { ok: true, number: result.orderNumber };
}

export async function saveOrderNoteAction(formData: FormData) {
  await requireAdmin("orders");

  await setOrderNote(text(formData, "number"), text(formData, "note").slice(0, 2000));
  redirect(returnPath(formData, `${ADMIN_PATH}/porudzbine`));
}

export async function saveCustomerNoteAction(formData: FormData) {
  await requireAdmin("orders");

  const key = text(formData, "key");
  if (/^[A-Za-z0-9_-]{2,191}$/.test(key)) {
    await setCustomerNote(key, text(formData, "note").slice(0, 5000));
  }
  redirect(`${ADMIN_PATH}/kupci/${key}?ok=${encodeURIComponent("Beleška je sačuvana.")}`);
}

/* ---------- Zahtevi za povrat ---------- */

/** Odgovor na zahtev kupca za povrat. Kupac ga dobija emailom; sam povraćaj se upisuje kada roba stigne. */
export async function resolveReturnAction(formData: FormData) {
  await requireAdmin("orders");
  const number = text(formData, "number");
  const id = wholeNumber(formData, "id");
  const approved = text(formData, "decision") === "approve";
  const answer = text(formData, "answer").slice(0, 1000);
  if (!approved && answer === "") backWithError(orderPath(number), "Uz odbijanje napišite kupcu razlog.");
  const request = id === null ? null : await resolveReturn(id, approved ? "approved" : "rejected", answer);
  if (!request) backWithError(orderPath(number), "Zahtev je već rešen.");

  await addOrderEvent(await getDb(), request.orderNumber, `Zahtev za povrat je ${approved ? "odobren" : "odbijen"}${answer ? `: ${answer}` : ""}`);
  after(async () => {
    const [order, settings] = await Promise.all([getOrder(request.orderNumber), getSettings()]);
    if (!order?.customer.email) return;
    // Kupcu na jeziku na kom je poručio.
    const mailT = await shopT(order.lang ?? settings.store.language);
    const firstName = order.customer.name.split(" ")[0];
    const { errors } = await sendMails(settings, [
      {
        to: order.customer.email,
        subject: `${mailT("Povrat za porudžbinu #{broj}", { broj: order.number })} — ${settings.store.name}`,
        ...simpleEmail(settings, {
          message: [
            approved
              ? mailT("Zdravo {ime}, vaš zahtev za povrat za porudžbinu #{broj} je odobren.", { ime: firstName, broj: order.number })
              : mailT("Zdravo {ime}, vaš zahtev za povrat za porudžbinu #{broj} nažalost nije odobren.", { ime: firstName, broj: order.number }),
            mailT("Zatraženo: {stavke}.", { stavke: request.items.map((item) => `${item.qty} × ${item.name}`).join(", ") }),
            answer,
          ].filter(Boolean).join("\n\n"),
        }),
      },
    ]);
    if (errors.length > 0) await addOrderEvent(await getDb(), order.number, `Email o zahtevu za povrat nije poslat: ${errors[0]}`);
  });
  refresh();
  await audit("Odgovoreno na zahtev za povrat", formData);
  redirect(orderPath(request.orderNumber));
}

/* ---------- Utisci ---------- */

const REVIEWS_PATH = `${ADMIN_PATH}/utisci`;

export async function reviewStatusAction(formData: FormData) {
  await requireAdmin("orders");
  const id = wholeNumber(formData, "id");
  const status = text(formData, "status");
  if (id !== null && (status === "approved" || status === "rejected" || status === "pending")) await setReviewStatus(id, status);
  refreshSite();
  await audit("Promenjen status utiska", formData);
  redirect(REVIEWS_PATH);
}

export async function deleteReviewAction(formData: FormData) {
  await requireAdmin("orders");
  const id = wholeNumber(formData, "id");
  if (id !== null) await deleteReview(id);
  refreshSite();
  await audit("Obrisan utisak", formData);
  redirect(REVIEWS_PATH);
}

/* ---------- Podaci kupca na zahtev ---------- */

/** Briše podatke kupca na njegov zahtev. Porudžbine ostaju bez imena, kontakta i adrese. */
export async function eraseCustomerAction(formData: FormData) {
  await requireAdmin("orders");
  const key = text(formData, "key");
  const count = await eraseCustomer(key);
  refresh();
  await audit("Obrisani podaci kupca", formData);
  redirect(`${ADMIN_PATH}/kupci?ok=${encodeURIComponent(count > 0 ? `Podaci kupca su obrisani. Porudžbina bez ličnih podataka: ${count}.` : "Kupac više ne postoji.")}`);
}

/* ---------- Novosti ---------- */

const MESSAGES_PATH = `${ADMIN_PATH}/poruke`;

/** Poruka svim prijavljenima na novosti. Slanje ide u pozadini; tok se vidi na stranici Poruke. */
export async function sendCampaignAction(formData: FormData) {
  await requireAdmin("orders");
  const subject = text(formData, "subject").slice(0, 200);
  const body = text(formData, "body").slice(0, 10000);
  if (!subject || body.length < 10) backWithError(MESSAGES_PATH, "Upišite naslov i tekst poruke.");
  const settings = await getSettings();
  if (!isMailReady(settings)) backWithError(MESSAGES_PATH, "Email nije povezan. Upišite SMTP nalog u Podešavanjima.");
  const recipients = await getRecipients();
  if (recipients.length === 0) backWithError(MESSAGES_PATH, "Nema prijavljenih na novosti.");
  // Link za odjavu u poruci mora da vodi na javnu adresu sajta.
  const base = linkBase(settings, await headers());
  if (!base) backWithError(MESSAGES_PATH, NO_SITE_URL);

  const id = await createCampaign(subject, body, recipients.length);
  after(() => sendCampaign(id, base));
  refresh();
  await audit("Poslate novosti", formData);
  redirect(`${MESSAGES_PATH}?ok=${encodeURIComponent(`Poruka se šalje na ${recipients.length} adresa.`)}`);
}

/* ---------- Analitika ---------- */

export async function saveAnalyticsAction(formData: FormData) {
  await requireAdmin("settings");
  const ga4 = text(formData, "ga4").toUpperCase();
  const metaPixel = text(formData, "metaPixel");
  // Oznake idu u kod stranice, pa prolazi samo njihov tačan oblik.
  if (ga4 !== "" && !/^G-[A-Z0-9]{4,20}$/.test(ga4)) backWithError(SETTINGS_PATH, "GA4 oznaka izgleda ovako: G-XXXXXXXXXX.");
  if (metaPixel !== "" && !/^\d{5,20}$/.test(metaPixel)) backWithError(SETTINGS_PATH, "Meta Pixel ID je broj, npr. 123456789012345.");
  await updateContent((content) => {
    content.settings.analytics = { ga4, metaPixel };
  });
  refreshSite();
  await audit("Sačuvana analitika", formData);
  backWithNotice("Analitika je sačuvana.");
}

/* ---------- Prijava kupaca ---------- */

export async function saveAuthAction(formData: FormData) {
  await requireAdmin("settings");
  const googleClientId = text(formData, "googleClientId").slice(0, 200);
  const secret = text(formData, "googleClientSecret").slice(0, 200);
  if (googleClientId !== "" && !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(googleClientId)) {
    backWithError(SETTINGS_PATH, "Google Client ID se završava sa .apps.googleusercontent.com.");
  }
  await updateContent((content) => {
    // Tajna se ne šalje nazad u formu: prazno polje je ostavlja kakva jeste, a bez ID-ja se briše.
    const googleClientSecret = googleClientId === "" ? "" : secret || content.settings.auth.googleClientSecret;
    content.settings.auth = { googleClientId, googleClientSecret };
  });
  refreshSite();
  await audit("Sačuvana prijava kupaca", formData);
  backWithNotice("Prijava kupaca je sačuvana.");
}

/* ---------- Napuštene korpe ---------- */

const CARTS_PATH = `${ADMIN_PATH}/korpe`;

export async function saveAbandonedAction(formData: FormData) {
  await requireAdmin("orders");
  const hours = Math.round(Number(text(formData, "delayHours")));
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
    backWithError(CARTS_PATH, "Podsetnik se šalje posle najmanje 1, a najviše 168 sati.");
  }
  await updateContent((content) => {
    content.settings.abandoned = {
      enabled: formData.get("enabled") === "on",
      delayHours: hours,
      subject: text(formData, "subject").slice(0, 200) || defaultSettings.abandoned.subject,
      text: text(formData, "text").slice(0, 2000) || defaultSettings.abandoned.text,
    };
  });
  refreshSite();
  await audit("Sačuvana podešavanja podsetnika za korpu", formData);
  redirect(`${CARTS_PATH}?ok=${encodeURIComponent("Podešavanja podsetnika su sačuvana.")}`);
}

/** Šalje podsetnike kojima je vreme odmah, bez čekanja na raspored. */
export async function sendRemindersAction() {
  await requireAdmin("orders");
  const sent = await sendDueReminders();
  refresh();
  redirect(`${CARTS_PATH}?ok=${encodeURIComponent(`Poslato podsetnika: ${sent}.`)}`);
}

/* ---------- Poruke ---------- */

export async function deleteMessageAction(formData: FormData) {
  await requireAdmin("orders");

  const id = wholeNumber(formData, "id");
  if (id !== null) await deleteMessage(id);
  await audit("Obrisana poruka", formData);
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
  await requireAdmin("settings");

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
    const languageBefore = content.settings.store.language;
    const mainLanguage = langCode(formData.get("language")) ?? languageBefore;
    content.settings.store = {
      name,
      phone: text(formData, "phone"),
      email,
      address: text(formData, "address"),
      legal: content.settings.store.legal,
      currency,
      currencyDecimals: text(formData, "currencyDecimals") === "2" ? 2 : 0,
      language: mainLanguage,
      languages: storeLanguages(text(formData, "languages"), mainLanguage),
      panelLanguage: isLang(formData.get("panelLanguage")) ? (formData.get("panelLanguage") as Lang) : content.settings.store.panelLanguage,
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
    // Novi jezik sajta: početni sadržaj koji vlasnik nije menjao i adrese početnih stranica prelaze na taj jezik.
    translateContent(content, languageBefore, content.settings.store.language);
  });
  refresh();
  await audit("Sačuvani podaci prodavnice", formData);
  backWithNotice("Podaci o prodavnici su sačuvani.");
}

/** Izbor teme sajta; važi odmah, za sve stranice prodavnice. */
export async function saveThemeAction(formData: FormData) {
  await requireAdmin("settings");
  const wanted = text(formData, "themeId");
  const theme = THEME_LIST.find((candidate) => candidate.id === wanted);
  if (!theme) backWithError(SETTINGS_PATH, "Izaberite temu sa spiska.");
  await updateContent((content) => {
    content.settings.themeId = theme.id;
  });
  refreshSite();
  await audit("Promenjena tema sajta", theme.name);
  backWithNotice(`Tema „${theme.name}“ je izabrana.`);
}

export async function saveAppearanceAction(formData: FormData) {
  await requireAdmin("settings");
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
  await audit("Sačuvan logo i favicon", formData);
  backWithNotice("Logo i favicon su sačuvani.");
}

/** Načini dostave iz uređivača: iznosi stižu kao tekst, granice težine u kilogramima. */
export async function saveShippingAction(input: unknown): Promise<SaveResult> {
  await requireAdmin("settings");
  const decimals = (await getSettings()).store.currencyDecimals;
  const amount = (value: unknown) => toMinor(typeof value === "string" ? value : "", decimals);

  const rows = (Array.isArray(input) ? input : []) as Record<string, unknown>[];
  const taken: string[] = [];
  const methods: unknown[] = [];
  for (const row of rows) {
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) return { ok: false, error: "Svaki način dostave mora imati naziv." };
    const price = amount(row.price) ?? 0;
    const freeFrom = amount(row.freeFrom);
    const rates = (Array.isArray(row.weightRates) ? row.weightRates : []).map((rate: Record<string, unknown>) => ({
      upTo: Math.round(Number(String(rate.upTo ?? "").replace(",", ".")) * 1000),
      price: amount(rate.price) ?? 0,
    }));
    if (Number.isNaN(price) || Number.isNaN(freeFrom) || rates.some((rate) => Number.isNaN(rate.price))) {
      return { ok: false, error: `„${name}": iznosi su brojevi, npr. 450 ili 4,50.` };
    }
    if (rates.some((rate) => !(rate.upTo > 0))) {
      return { ok: false, error: `„${name}": granica težine je broj kilograma veći od nule, npr. 2 ili 0,5.` };
    }
    // Način koji već postoji zadržava svoju oznaku; nov je dobija iz naziva.
    const id =
      typeof row.id === "string" && row.id && !taken.includes(row.id)
        ? row.id
        : uniqueSlug(name, taken).slice(0, 60) || `dostava-${taken.length + 1}`;
    taken.push(id);
    methods.push({ ...row, id, name, price, freeFrom, weightRates: rates });
  }
  const normalized = normalizeMethods(methods);
  if (normalized.length === 0) return { ok: false, error: "Mora postojati bar jedan način dostave." };

  await updateContent((content) => {
    content.settings.shipping = { methods: normalized };
  });
  refreshSite();
  await audit("Sačuvana dostava");
  return { ok: true };
}

export async function savePaymentAction(formData: FormData) {
  await requireAdmin("settings");

  const cod = formData.get("cod") === "on";
  const bank = formData.get("bank") === "on";
  const card = formData.get("card") === "on";
  const cardProvider = findProvider(text(formData, "cardProvider"))?.id ?? "";
  const bankInstructions = text(formData, "bankInstructions").slice(0, 2000);
  // Kartica se računa kao način plaćanja samo kada je procesor zaista povezan.
  const cardReady = card && findProvider(cardProvider)?.ready() === true;
  if (!cod && !bank && !cardReady) {
    backWithError(SETTINGS_PATH, "Bar jedan način plaćanja mora biti uključen. Kartica se računa tek kada je procesor povezan.");
  }
  if (bank && bankInstructions === "") {
    backWithError(SETTINGS_PATH, "Za uplatu na račun upišite podatke za uplatu.");
  }
  await updateContent((content) => {
    content.settings.payment = { cod, bank, bankInstructions, card, cardProvider, returns: formData.get("returns") === "on" };
  });
  refreshSite();
  await audit("Sačuvani načini plaćanja", formData);
  backWithNotice("Plaćanje i povrat su sačuvani.");
}

export async function saveTaxAction(formData: FormData) {
  await requireAdmin("settings");
  const percent = Number(text(formData, "taxPercent").replace(",", "."));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    backWithError(SETTINGS_PATH, "Stopa PDV-a je broj od 0 do 100.");
  }
  await updateContent((content) => {
    content.settings.store.legal = text(formData, "legal").slice(0, 1000);
    content.settings.tax = {
      enabled: formData.get("taxEnabled") === "on",
      percent,
      invoiceEmail: INVOICE_EMAILS.find((value) => value === text(formData, "invoiceEmail")) ?? "none",
    };
  });
  await audit("Sačuvan račun i PDV", formData);
  backWithNotice("Račun i PDV su sačuvani.");
}

export async function saveStatusEmailsAction(formData: FormData) {
  await requireAdmin("settings");
  await updateContent((content) => {
    for (const key of STATUS_EMAILS) {
      content.settings.mail.statusEmails[key] = {
        enabled: formData.get(`${key}Enabled`) === "on",
        subject: text(formData, `${key}Subject`).slice(0, 200) || defaultSettings.mail.statusEmails[key].subject,
        text: text(formData, `${key}Text`).slice(0, 2000) || defaultSettings.mail.statusEmails[key].text,
      };
    }
  });
  await audit("Sačuvane poruke o statusu", formData);
  backWithNotice("Poruke o statusu su sačuvane.");
}

export async function saveMailAction(formData: FormData) {
  await requireAdmin("settings");

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
  await audit("Sačuvana podešavanja emaila", formData);
  backWithNotice("Podešavanja emaila su sačuvana.");
}

export async function uploadTemplateAction(formData: FormData) {
  await requireAdmin("settings");

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
  await audit("Ubačen šablon emaila", formData);
  backWithNotice("Vaš šablon je ubačen. Pogledajte pregled pre nego što stigne prva porudžbina.");
}

export async function resetTemplateAction() {
  await requireAdmin("settings");

  await updateContent((content) => {
    content.settings.mail.customTemplate = false;
  });
  await removeCustomTemplate();
  await audit("Vraćen podrazumevani šablon emaila");
  backWithNotice("Koristi se naš šablon.");
}

export async function sendTestEmailAction() {
  await requireAdmin("settings");

  const error = await sendTestEmail();
  if (error) backWithError(SETTINGS_PATH, `Probni email nije poslat — ${error}`);
  backWithNotice(
    "Probni email je poslat na vašu adresu: jedna poruka kakvu dobijate vi, jedna kakvu dobija kupac.",
  );
}
