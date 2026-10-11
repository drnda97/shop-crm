import { maxQty } from "@/lib/cart";
import {
  currentPrice,
  isAvailable,
  isOnSale,
  isVariantAvailable,
  lowStockLabel,
  priceRange,
  regularPrice,
  salePercent,
  variantLabel,
  type Collection,
  type Page,
  type Product,
  type Variant,
} from "@/lib/catalog";
import { imageSizes } from "@/lib/media";
import { collectImages, sectionType } from "@/lib/sections";
import {
  allowedOrigins,
  enabledPayments,
  paymentLabels,
  type Settings,
} from "@/lib/settings";

/**
 * Pomoćne funkcije javnog API-ja (app/api/v1): CORS, odgovori i oblik podataka
 * koji vidi sajt. U API ide samo ono što kupac ionako sme da vidi — nikad ceo
 * objekat podešavanja (u njemu je i lozinka za SMTP).
 */

/** Zaglavlja koja sajtu na drugoj adresi dozvoljavaju da zove API iz pregledača. */
export function corsHeaders(request: Request, settings: Settings): Record<string, string> {
  const origins = allowedOrigins(settings.store);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (origins.length === 0) {
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }
  const origin = request.headers.get("origin");
  headers["Vary"] = "Origin";
  if (origin && origins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

/** Osnova za pune adrese slika: PUBLIC_URL, ili adresa sa koje je stigao zahtev. */
export function baseUrl(request: Request): string {
  const configured = process.env.PUBLIC_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return new URL(request.url).origin;
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol;
  return `${protocol.replace(/:$/, "")}://${host}`;
}

function mediaUrl(src: string | undefined, base: string): string | null {
  return src ? `${base}${src}` : null;
}

function sizes(src: string | undefined, base: string) {
  const all = src ? imageSizes(src) : null;
  return all && Object.fromEntries(Object.entries(all).map(([name, path]) => [name, `${base}${path}`]));
}

export function publicVariant(product: Product, variant: Variant, base: string) {
  const available = isVariantAvailable(product, variant);
  return {
    /** Šalje se uz stavku korpe: { slug, qty, variant: id }. */
    id: variant.id,
    /** Vrednost svake opcije, redom kojim su opcije u `options`. */
    values: variant.values,
    label: variantLabel(variant),
    sku: variant.sku || product.sku,
    price: regularPrice(product, variant),
    currentPrice: currentPrice(product, variant),
    onSale: isOnSale(product, variant),
    available,
    maxQty: available ? maxQty(product, variant) : 0,
    lowStockLabel: lowStockLabel(product, variant),
    image: mediaUrl(variant.image, base),
  };
}

export function publicProduct(product: Product, base: string) {
  const range = priceRange(product);
  return {
    slug: product.slug,
    name: product.name,
    sku: product.sku,
    category: product.category || null,
    summary: product.summary,
    description: product.description,
    attributes: product.attributes,
    /** Redovna cena i cena koju kupac plaća, u najmanjim jedinicama valute. */
    price: product.price,
    /** Kod proizvoda sa varijantama: najniža cena među varijantama koje mogu da se poruče. */
    currentPrice: range.from,
    /** Varijante imaju različite cene, pa se `currentPrice` prikazuje kao „od". */
    priceVaries: range.varies,
    onSale: isOnSale(product),
    salePercent: salePercent(product),
    weight: product.weight,
    available: isAvailable(product),
    /** Najviše komada u jednoj porudžbini; kod proizvoda sa varijantama važi `maxQty` varijante. */
    maxQty: isAvailable(product) ? maxQty(product) : 0,
    /** Kod proizvoda sa varijantama oznaka je uz varijantu (`variants[n].lowStockLabel`). */
    lowStockLabel: lowStockLabel(product),
    image: mediaUrl(product.image, base),
    /** Ista slika u manjim širinama (thumb, small, medium, large, full); null za staru sliku. */
    imageSizes: sizes(product.image, base),
    gallery: product.gallery.map((src) => `${base}${src}`),
    gallerySizes: product.gallery.map((src) => sizes(src, base)),
    options: product.options,
    /** Kombinacije opcija koje kupac može da izabere; prazno kod proizvoda bez opcija. */
    variants: product.variants
      .filter((variant) => variant.enabled)
      .map((variant) => publicVariant(product, variant, base)),
    highlight: { ...product.highlight, image: mediaUrl(product.highlight.image, base) },
  };
}

export function publicCollection(collection: Collection) {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    productSlugs: collection.productSlugs,
  };
}

export function publicPage(page: Page, base: string) {
  const withUrl = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(withUrl);
    if (typeof value !== "object" || value === null) return value;
    const entries = Object.entries(value).map(([key, item]) => [
      key,
      // Slike dobijaju punu adresu, da ih sajt na drugoj adresi može prikazati.
      key === "src" && typeof item === "string" && item ? `${base}${item}` : withUrl(item),
    ]);
    return Object.fromEntries(entries);
  };
  const images = page.sections.flatMap((section) =>
    collectImages(sectionType(section.type)?.fields ?? [], section.data),
  );
  return {
    slug: page.slug,
    title: page.title,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    showInFooter: page.showInFooter,
    sections: page.sections.map((section) => ({ ...section, data: withUrl(section.data) })),
    /** Tekst svih sekcija „Tekst" i sve slike stranice — oblik iz prve verzije API-ja. */
    body: page.sections
      .filter((section) => section.type === "text")
      .map((section) => [section.data.heading, section.data.body].filter(Boolean).join("\n\n"))
      .join("\n\n"),
    images: images.map((image) => ({ src: `${base}${image.src}`, alt: image.alt })),
  };
}

export function publicStore(settings: Settings, base: string) {
  const { store, shipping, payment } = settings;
  return {
    name: store.name,
    phone: store.phone,
    email: store.email,
    address: store.address,
    currency: { code: store.currency, decimals: store.currencyDecimals },
    locale: store.locale,
    colors: settings.colors,
    fonts: settings.fonts,
    menu: settings.site.menu,
    logo: mediaUrl(settings.logo, base),
    favicon: mediaUrl(settings.favicon, base),
    shipping: {
      price: shipping.price,
      /** Vrednost od koje je dostava besplatna; null kada je isključena. */
      freeFrom: shipping.freeEnabled ? shipping.freeFrom : null,
      /** Kupac može da izabere preuzimanje u salonu (deliveryMethod: "pickup"). */
      pickup: shipping.pickupEnabled,
    },
    paymentMethods: enabledPayments(settings).map((id) => ({
      id,
      label: paymentLabels[id],
      ...(id === "bank" ? { instructions: payment.bankInstructions } : {}),
    })),
  };
}
