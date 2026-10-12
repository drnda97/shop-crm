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
import { cardProvider } from "@/lib/payments";
import { collectImages, SECTION_TYPES, sectionType } from "@/lib/sections";
import {
  allowedOrigins,
  enabledPayments,
  paymentLabels,
  type Settings,
} from "@/lib/settings";
import { fontStack, themeVars } from "@/lib/theme";

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
    /** Glavna kategorija i sve kategorije proizvoda (id). */
    category: product.category || null,
    categories: product.categories,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    /** Ručno izabrani slični proizvodi (slug). */
    related: product.related,
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

/** Slike u sadržaju (ključ `src`) dobijaju punu adresu, da ih sajt na drugoj adresi može prikazati. */
function withImageUrls(value: unknown, base: string): unknown {
  if (Array.isArray(value)) return value.map((item) => withImageUrls(item, base));
  if (typeof value !== "object" || value === null) return value;
  const entries = Object.entries(value).map(([key, item]) => [
    key,
    key === "src" && typeof item === "string" && item.startsWith("/") ? `${base}${item}` : withImageUrls(item, base),
  ]);
  return Object.fromEntries(entries);
}

/**
 * Sve što se u panelu uređuje u „Izgled sajta": traka, meni, podnožje, boje, fontovi i
 * tekstovi stranica sa stalnim rasporedom. Sajt van ove aplikacije od ovoga i od
 * /pages/{slug} slaže isti sadržaj koji vlasnik vidi u uređivaču.
 */
export function publicSite(settings: Settings, base: string) {
  const { site, colors, fonts } = settings;
  return {
    announcement: { text: site.announcement, href: site.announcementHref },
    menu: site.menu,
    footer: { tagline: site.tagline, columns: site.footerColumns, note: site.footerNote, legalLinks: site.legalLinks },
    colors,
    fonts: {
      display: { id: fonts.display, stack: fontStack(fonts.display) },
      body: { id: fonts.body, stack: fontStack(fonts.body) },
    },
    /** Iste CSS promenljive koje koristi ugrađena prodavnica (boje sa izvedenim nijansama, fontovi). */
    cssVars: themeVars(colors, fonts),
    logo: mediaUrl(settings.logo, base),
    favicon: mediaUrl(settings.favicon, base),
    /** Tekstovi i fotografije stranica kolekcije, proizvoda, naloga, plaćanja i korpe. */
    templates: withImageUrls(settings.templates, base),
  };
}

/** Vrste sekcija i njihova polja: šta sajt može da dobije u `sections` stranice. */
export function publicSectionTypes() {
  return SECTION_TYPES.map(({ type, label, fields }) => ({ type, label, fields }));
}

export function publicPage(page: Page, base: string) {
  const withUrl = (value: unknown) => withImageUrls(value, base);
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
  const delivery = shipping.methods.find((method) => method.kind === "delivery") ?? shipping.methods[0];
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
      /** Načini dostave. Cena: prvi red iz `weightRates` čija granica (g) pokriva težinu, inače `price`; od `freeFrom` je besplatno. */
      methods: shipping.methods,
      // Polja iz prve verzije API-ja, po prvom načinu dostave.
      price: delivery?.price ?? 0,
      freeFrom: delivery?.freeFrom ?? null,
      pickup: shipping.methods.some((method) => method.kind === "pickup"),
    },
    paymentMethods: enabledPayments(settings, cardProvider(settings) !== null).map((id) => ({
      id,
      label: paymentLabels[id],
      ...(id === "bank" ? { instructions: payment.bankInstructions } : {}),
    })),
  };
}
