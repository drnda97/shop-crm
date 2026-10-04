"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ADMIN_PATH,
  checkCredentials,
  createSession,
  destroySession,
  requireAdmin,
} from "@/lib/admin-auth";
import type { LowStockMode, Product } from "@/lib/catalog";
import {
  getCategories,
  getCollections,
  getDiscounts,
  getPages,
  getProducts,
  getSettings,
  removeUpload,
  saveUpload,
  updateContent,
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
import { defaultSettings, isHexColor, type ThemeColors } from "@/lib/settings";

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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
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
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(":");
      return colon === -1
        ? { title: line, text: "" }
        : { title: line.slice(0, colon).trim(), text: line.slice(colon + 1).trim() };
    });
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

  const product: Product = {
    slug,
    name,
    sku: text(formData, "sku").slice(0, 64),
    category,
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
  };
  await updateContent((content) => {
    content.products = existing
      ? content.products.map((item) => (item.slug === slug ? product : item))
      : [...content.products, product];
  });
  if (file) await removeUpload(existing?.image);
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

  const label = text(formData, "label");
  const id = uniqueSlug(
    label,
    (await getCategories()).map((category) => category.id),
  );
  if (!id) backWithError(CATEGORIES_PATH, "Upišite naziv kategorije.");

  await updateContent((content) => {
    content.categories.push({ id, label });
  });
  refresh();
  redirect(CATEGORIES_PATH);
}

export async function saveCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  const label = text(formData, "label");
  if (!label) backWithError(CATEGORIES_PATH, "Naziv kategorije ne može biti prazan.");

  await updateContent((content) => {
    const category = content.categories.find((candidate) => candidate.id === id);
    if (category) category.label = label;
  });
  refresh();
  redirect(CATEGORIES_PATH);
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  const used = (await getProducts()).filter((product) => product.category === id).length;
  if (used > 0) {
    backWithError(
      CATEGORIES_PATH,
      "Kategoriju još koriste proizvodi. Prebacite ih u drugu pa je onda obrišite.",
    );
  }
  await updateContent((content) => {
    content.categories = content.categories.filter((category) => category.id !== id);
  });
  refresh();
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

export async function savePageAction(formData: FormData) {
  await requireAdmin();

  const pages = await getPages();
  const editedSlug = text(formData, "slug");
  const existing = pages.find((page) => page.slug === editedSlug);
  const formPath = existing ? `${PAGES_PATH}/${existing.slug}` : `${PAGES_PATH}/nova`;
  if (editedSlug && !existing) backWithError(PAGES_PATH, "Stranica više ne postoji.");

  const title = text(formData, "title");
  if (!title) backWithError(formPath, "Upišite naslov stranice.");

  // Oznaka se pravi jednom, iz naslova, i više se ne menja — sajt po njoj čita stranicu.
  const slug = existing?.slug ?? uniqueSlug(title, ["nova", ...pages.map((page) => page.slug)]);
  if (!slug) backWithError(formPath, "Naslov mora da sadrži bar jedno slovo ili cifru.");

  const fields = {
    title,
    body: text(formData, "body"),
    showInFooter: formData.get("showInFooter") === "on",
  };
  await updateContent((content) => {
    const page = content.pages.find((candidate) => candidate.slug === slug);
    if (page) Object.assign(page, fields);
    else content.pages.push({ slug, ...fields, images: [] });
  });

  refresh();
  redirect(`${PAGES_PATH}/${slug}`);
}

export async function deletePageAction(formData: FormData) {
  await requireAdmin();

  const slug = text(formData, "slug");
  const page = (await getPages()).find((candidate) => candidate.slug === slug);
  if (page) {
    await updateContent((content) => {
      content.pages = content.pages.filter((candidate) => candidate.slug !== slug);
    });
    for (const item of page.images) await removeUpload(item.src);
    refresh();
  }
  redirect(PAGES_PATH);
}

/** Dodaje fotografiju stranici ili, kada stigne `imageId`, menja postojeću. */
export async function savePageImageAction(formData: FormData) {
  await requireAdmin();

  const slug = text(formData, "slug");
  const page = (await getPages()).find((candidate) => candidate.slug === slug);
  if (!page) backWithError(PAGES_PATH, "Stranica više ne postoji.");
  const pagePath = `${PAGES_PATH}/${slug}`;

  const imageId = text(formData, "imageId");
  const existing = page.images.find((item) => item.id === imageId);
  const file = image(formData, "image");
  if (!file) backWithError(pagePath, "Izaberite sliku pre slanja.");

  const upload = await saveUpload(file, slug);
  if (!upload.ok) backWithError(pagePath, upload.error);
  await updateContent((content) => {
    const target = content.pages.find((candidate) => candidate.slug === slug);
    if (!target) return;
    const item = target.images.find((candidate) => candidate.id === imageId);
    if (item) item.src = upload.src;
    else
      target.images.push({
        id: Date.now().toString(36),
        src: upload.src,
        alt: text(formData, "alt"),
      });
  });
  await removeUpload(existing?.src);

  refresh();
  redirect(pagePath);
}

export async function deletePageImageAction(formData: FormData) {
  await requireAdmin();

  const slug = text(formData, "slug");
  const imageId = text(formData, "imageId");
  const page = (await getPages()).find((candidate) => candidate.slug === slug);
  const item = page?.images.find((candidate) => candidate.id === imageId);
  if (item) {
    await updateContent((content) => {
      const target = content.pages.find((candidate) => candidate.slug === slug);
      if (target) target.images = target.images.filter((candidate) => candidate.id !== imageId);
    });
    await removeUpload(item.src);
    refresh();
  }
  redirect(`${PAGES_PATH}/${slug}`);
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

  const colors = { ...current.colors };
  for (const key of Object.keys(colors) as (keyof ThemeColors)[]) {
    const value = text(formData, key);
    // Boje idu pravo u HTML emaila i CSS sajta, pa prolazi samo oblik #rrggbb.
    if (!isHexColor(value)) backWithError(SETTINGS_PATH, "Boja mora biti u obliku #rrggbb.");
    colors[key] = value.toLowerCase();
  }

  // Slike: nova zamenjuje staru; „Ukloni" je briše.
  const images = { logo: current.logo, favicon: current.favicon };
  const replaced: (string | undefined)[] = [];
  for (const key of ["logo", "favicon"] as const) {
    const file = image(formData, key);
    if (file) {
      const upload = await saveUpload(file, key);
      if (!upload.ok) backWithError(SETTINGS_PATH, upload.error);
      replaced.push(images[key]);
      images[key] = upload.src;
    } else if (formData.get(`${key}Remove`) === "on") {
      replaced.push(images[key]);
      images[key] = undefined;
    }
  }

  await updateContent((content) => {
    content.settings = { ...content.settings, colors, ...images };
  });
  for (const src of replaced) await removeUpload(src);

  refresh();
  backWithNotice("Izgled je sačuvan.");
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
  await updateContent((content) => {
    content.settings.shipping = { price, freeEnabled, freeFrom };
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
