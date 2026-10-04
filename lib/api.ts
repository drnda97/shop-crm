import { maxQty } from "@/lib/cart";
import {
  currentPrice,
  isAvailable,
  isOnSale,
  lowStockLabel,
  salePercent,
  type Collection,
  type Page,
  type Product,
} from "@/lib/catalog";
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

export function publicProduct(product: Product, base: string) {
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
    currentPrice: currentPrice(product),
    onSale: isOnSale(product),
    salePercent: salePercent(product),
    weight: product.weight,
    available: isAvailable(product),
    /** Najviše komada u jednoj porudžbini. */
    maxQty: isAvailable(product) ? maxQty(product) : 0,
    lowStockLabel: lowStockLabel(product),
    image: mediaUrl(product.image, base),
    gallery: product.gallery.map((src) => `${base}${src}`),
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
  return {
    slug: page.slug,
    title: page.title,
    body: page.body,
    showInFooter: page.showInFooter,
    images: page.images.map((image) => ({ src: `${base}${image.src}`, alt: image.alt })),
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
    logo: mediaUrl(settings.logo, base),
    favicon: mediaUrl(settings.favicon, base),
    shipping: {
      price: shipping.price,
      /** Vrednost od koje je dostava besplatna; null kada je isključena. */
      freeFrom: shipping.freeEnabled ? shipping.freeFrom : null,
    },
    paymentMethods: enabledPayments(settings).map((id) => ({
      id,
      label: paymentLabels[id],
      ...(id === "bank" ? { instructions: payment.bankInstructions } : {}),
    })),
  };
}

// Ograničenje broja porudžbina po adresi, protiv automatskog zatrpavanja. Pamti se u
// memoriji procesa, pa na hostingu sa više procesa važi po procesu — gruba, ali besplatna zaštita.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ORDERS = 10;
const recent = new Map<string, number[]>();

export function tooManyOrders(request: Request): boolean {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (times.length >= MAX_ORDERS) {
    recent.set(ip, times);
    return true;
  }
  times.push(now);
  recent.set(ip, times);
  // Da mapa ne raste bez kraja: povremeno se izbace adrese bez skorašnjih zahteva.
  if (recent.size > 5000) {
    for (const [key, value] of recent) {
      if (value.every((time) => now - time >= WINDOW_MS)) recent.delete(key);
    }
  }
  return false;
}
