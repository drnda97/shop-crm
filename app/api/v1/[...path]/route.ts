import { langCode } from "@/lib/i18n";
import { contentWords, shopT } from "@/lib/i18n/server";
import { translateDeep } from "@/lib/i18n/walk";
import {
  baseUrl,
  corsHeaders,
  publicCollection,
  publicPage,
  publicProduct,
  publicSectionTypes,
  publicSite,
  publicVariant,
  publicStore,
} from "@/lib/api";
import { getVisiblePosts } from "@/lib/blog";
import { toLines } from "@/lib/cart";
import { currentPrice, getCollectionProducts, inCategory } from "@/lib/catalog";
import {
  getCategories,
  getCollections,
  getPages,
  getProducts,
  getSettings,
} from "@/lib/content";
import { checkCode, quoteCart, submitOrder } from "@/lib/order-store";
import { parseItems } from "@/lib/orders";
import { clientIp, TOO_MANY, tooMany } from "@/lib/rate-limit";
import { parseRichText, plainText } from "@/lib/rich-text";
import type { Settings } from "@/lib/settings";
import { availableMethods } from "@/lib/shipping";

/**
 * Javni API prodavnice — sve što sajtu treba da prikaže proizvode i primi porudžbinu.
 *
 * Svaki poziv prima ?lang=en: sadržaj i poruke na tom jeziku, kada ga prodavnica ima.
 *
 *   GET  /api/v1/store                 naziv, valuta, dostava, načini plaćanja, boje
 *   GET  /api/v1/products              ?category=  ?collection=  ?q=
 *   GET  /api/v1/products/{slug}
 *   GET  /api/v1/categories
 *   GET  /api/v1/collections
 *   GET  /api/v1/collections/{id}      kolekcija sa proizvodima
 *   GET  /api/v1/site                  traka, meni, podnožje, boje, fontovi, tekstovi stalnih stranica
 *   GET  /api/v1/sections              vrste sekcija i njihova polja
 *   GET  /api/v1/pages
 *   GET  /api/v1/pages/{slug}
 *   GET  /api/v1/blog                  objavljeni članci, najnoviji prvi (?tag=…)
 *   GET  /api/v1/blog/{slug}           članak sa tekstom (body) i tekstom razloženim na delove (blocks)
 *   POST /api/v1/cart                  { items, discountCode? } → stavke i obračun
 *                                      stavka: { slug, qty, variant? } — variant je id varijante
 *   POST /api/v1/discounts/check       { code }
 *   POST /api/v1/orders                { customer, items, discountCode?, paymentMethod?, deliveryMethod? }
 *   GET|POST /api/v1/payments/{id}     potvrda procesora kartica (app/api/v1/payments)
 *
 * Cene i stanje se uvek računaju ovde, na serveru; sajt šalje samo šta je u korpi.
 */

type Context = { params: Promise<{ path: string[] }> };

/**
 * Jezik odgovora: ?lang=en (ili zaglavlje X-Shop-Lang) kada prodavnica taj jezik ima, inače
 * glavni. Na jeziku koji nije glavni sadržaj i poruke stižu prevedeni, kao na sajtu.
 */
function replyLang(request: Request, settings: Settings): string {
  const asked = langCode(new URL(request.url).searchParams.get("lang") ?? request.headers.get("x-shop-lang"));
  const { language, languages } = settings.store;
  return asked && languages.includes(asked) ? asked : language;
}

async function reply(request: Request, settings: Settings, body: unknown, status = 200): Promise<Response> {
  const lang = replyLang(request, settings);
  let out = body;
  if (lang !== settings.store.language) out = translateDeep(out, await contentWords(lang));
  // Poruke o grešci su u kodu na srpskom; prevode se na jezik odgovora.
  if (lang !== "sr" && typeof out === "object" && out !== null) {
    const t = await shopT(lang);
    const messages = out as { message?: unknown; errors?: unknown; error?: unknown };
    out = {
      ...out,
      ...(typeof messages.message === "string" ? { message: t(messages.message) } : {}),
      ...(typeof messages.error === "string" && messages.error !== "Not found" ? { error: t(messages.error) } : {}),
      ...(typeof messages.errors === "object" && messages.errors !== null
        ? { errors: Object.fromEntries(Object.entries(messages.errors).map(([field, text]) => [field, typeof text === "string" ? t(text) : text])) }
        : {}),
    };
  }
  return Response.json(out, {
    status,
    headers: { ...corsHeaders(request, settings), "Cache-Control": "no-store", "Content-Language": lang },
  });
}

function notFound(request: Request, settings: Settings): Promise<Response> {
  return reply(request, settings, { error: "Not found" }, 404);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request, await getSettings()) });
}

/** Javni API radi samo kada ga vlasnik uključi (panel → Integracije). */
function apiOff(request: Request, settings: Settings): Response | null {
  if (settings.access.publicApi) return null;
  return Response.json({ error: "API is disabled" }, { status: 403, headers: { ...corsHeaders(request, settings), "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: Context) {
  const [resource, id, extra] = (await params).path;
  const settings = await getSettings();
  const off = apiOff(request, settings);
  if (off) return off;
  const base = baseUrl(request);
  if (extra !== undefined) return notFound(request, settings);

  if (resource === "store" && !id) {
    const pages = (await getPages()).filter((page) => page.published);
    return reply(request, settings, {
      ...publicStore(settings, base),
      footerPages: pages
        .filter((page) => page.showInFooter)
        .map((page) => ({ slug: page.slug, title: page.title })),
    });
  }

  if (resource === "site" && !id) return reply(request, settings, { site: publicSite(settings, base) });
  if (resource === "sections" && !id) return reply(request, settings, { sections: publicSectionTypes() });

  if (resource === "blog") {
    const absolute = (src: string) => (src ? `${base}${src}` : null);
    const posts = await getVisiblePosts();
    const card = (post: (typeof posts)[number]) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt || plainText(post.body, 180),
      image: absolute(post.image),
      imageAlt: post.imageAlt,
      author: post.author,
      tags: post.tags,
      publishedAt: post.publishedAt,
    });
    if (id) {
      const post = posts.find((candidate) => candidate.slug === id);
      if (!post) return notFound(request, settings);
      return reply(request, settings, {
        post: { ...card(post), body: post.body, blocks: parseRichText(post.body), seoTitle: post.seoTitle, seoDescription: post.seoDescription },
      });
    }
    const tag = new URL(request.url).searchParams.get("tag")?.toLowerCase();
    return reply(request, settings, {
      posts: posts.filter((post) => !tag || post.tags.some((candidate) => candidate.toLowerCase() === tag)).map(card),
    });
  }

  if (resource === "products") {
    // Nacrti se ne vide: za sajt je to isto kao da proizvod ne postoji.
    const products = (await getProducts()).filter((product) => product.active);
    if (id) {
      const product = products.find((candidate) => candidate.slug === id);
      if (!product) return notFound(request, settings);
      return reply(request, settings, { product: publicProduct(product, base) });
    }

    const query = new URL(request.url).searchParams;
    let list = products;
    const collectionId = query.get("collection");
    if (collectionId) {
      const collection = (await getCollections()).find((item) => item.id === collectionId);
      list = collection ? getCollectionProducts(collection, products) : [];
    }
    const category = query.get("category");
    if (category) {
      // Kategorija obuhvata i svoje podkategorije.
      const categories = await getCategories();
      list = list.filter((product) => inCategory(product, category, categories));
    }
    const search = query.get("q")?.trim().toLocaleLowerCase();
    if (search) {
      list = list.filter((product) =>
        `${product.name} ${product.sku} ${product.summary}`.toLocaleLowerCase().includes(search),
      );
    }
    return reply(request, settings, {
      products: list.map((product) => publicProduct(product, base)),
    });
  }

  if (resource === "categories" && !id) {
    return reply(request, settings, { categories: await getCategories() });
  }

  if (resource === "collections") {
    const collections = await getCollections();
    if (!id) return reply(request, settings, { collections: collections.map(publicCollection) });
    const collection = collections.find((candidate) => candidate.id === id);
    if (!collection) return notFound(request, settings);
    const products = (await getProducts()).filter((product) => product.active);
    return reply(request, settings, {
      collection: publicCollection(collection),
      products: getCollectionProducts(collection, products).map((product) =>
        publicProduct(product, base),
      ),
    });
  }

  if (resource === "pages") {
    // Nacrti se ne vide.
    const pages = (await getPages()).filter((page) => page.published);
    if (!id) {
      return reply(request, settings, {
        pages: pages.map(({ slug, title, showInFooter }) => ({ slug, title, showInFooter })),
      });
    }
    const page = pages.find((candidate) => candidate.slug === id);
    if (!page) return notFound(request, settings);
    return reply(request, settings, { page: publicPage(page, base) });
  }

  return notFound(request, settings);
}

export async function POST(request: Request, { params }: Context) {
  const route = (await params).path.join("/");
  const settings = await getSettings();
  const off = apiOff(request, settings);
  if (off) return off;
  const body = ((await readJson(request)) ?? {}) as Record<string, unknown>;

  if (route === "cart") {
    const base = baseUrl(request);
    const items = parseItems(body.items);
    const lines = toLines(items, await getProducts());
    const removed = items.filter(
      (item) =>
        !lines.some(
          (line) => line.product.slug === item.slug && (line.variant?.id ?? undefined) === item.variant,
        ),
    );
    // Dostava: izabrani način (deliveryMethod), ili prvi koji važi za poštanski broj (postalCode).
    const postalCode = typeof body.postalCode === "string" ? body.postalCode : "";
    const methods = availableMethods(settings.shipping.methods, postalCode);
    const method = methods.find((candidate) => candidate.id === body.deliveryMethod) ?? methods[0];
    // Popust: upisani kod ili automatski popust, onaj koji kupcu više štedi.
    const quoted = await quoteCart(lines, body.discountCode, method);
    return reply(request, settings, {
      lines: lines.map((line) => ({
        product: publicProduct(line.product, base),
        /** Izabrana varijanta, ili null kod proizvoda bez varijanti. */
        variant: line.variant ? publicVariant(line.product, line.variant, base) : null,
        qty: line.qty,
        lineTotal: (currentPrice(line.product, line.variant) ?? 0) * line.qty,
      })),
      /** Stavke koje su ispale: proizvod ili varijanta je obrisana, povučena ili je nema na stanju. */
      removedItems: removed.map((item) => ({ slug: item.slug, variant: item.variant ?? null })),
      /** Isto, samo oznake proizvoda — oblik iz prve verzije API-ja. */
      removed: [...new Set(removed.map((item) => item.slug))],
      /** Primenjen popust: { code, label, percent, amount, freeShipping }; `code` je prazan kod automatskog popusta. */
      discount: quoted.discount,
      discountError: quoted.codeError,
      pricing: quoted.pricing,
      /** Način dostave po kom je obračunato, i svi koji važe za poslati poštanski broj. */
      deliveryMethod: method?.id ?? null,
      deliveryMethods: methods.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        hint: candidate.hint,
        kind: candidate.kind,
      })),
    });
  }

  if (route === "discounts/check") {
    // Protiv nagađanja kodova.
    if (tooMany("promo", clientIp(request.headers), 40)) {
      return reply(request, settings, { ok: false, message: TOO_MANY }, 429);
    }
    return reply(request, settings, await checkCode(body.code));
  }

  if (route === "orders") {
    if (tooMany("order", clientIp(request.headers), 10)) {
      return reply(request, settings, { ok: false, errors: {}, message: TOO_MANY }, 429);
    }
    const result = await submitOrder(body);
    return reply(request, settings, result, result.ok ? 201 : 422);
  }

  return notFound(request, settings);
}
