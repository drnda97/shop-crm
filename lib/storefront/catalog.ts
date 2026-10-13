import { langName } from "@/lib/i18n";
import { getShopLang, translateForShop } from "@/lib/i18n/server";
import { maxQty } from "@/lib/cart";
import {
  categoryPath,
  categoryTree,
  currentPrice,
  isAvailable,
  isOnSale,
  isVariantAvailable,
  lowStockLabel,
  priceRange,
  regularPrice,
  salePercent,
  variantLabel,
} from "@/lib/catalog";
import type { Category, Collection, Product } from "@/lib/catalog";
import { getCategories, getCollections, getDiscounts, getProductsBySlugs, getSettings } from "@/lib/content";
import { listFacets, listSlugs, type ListingFilter } from "@/lib/listing";
import { getShopSettings } from "@/lib/storefront/pages";
import { isExpired } from "@/lib/discounts";
import { cardProvider } from "@/lib/payments";
import { enabledPayments, googleLoginReady, paymentLabels } from "@/lib/settings";
import { PAGE_SIZE, parseListingQuery, type Listing } from "@/lib/storefront/collection";
import { toCardProduct, type CardProduct, type ShopConfig, type ShopProduct } from "@/lib/storefront/products";

/**
 * Javna prodavnica čita katalog i podešavanja iz CRM-a, direktno iz baze
 * (isti proces, bez poziva API-ja). Samo za server.
 */

/** Kolekcije čiji naziv postaje oznaka na kartici proizvoda; prva u kojoj je proizvod pobeđuje. */
const TAG_COLLECTIONS = ["bestseler", "novo"];

/** Promo kod koji prodavnica obećava u prijavi na novosti i pri registraciji. */
const WELCOME_DISCOUNT_ID = "dobrodoslica";

/** Proizvod kako ga vidi kupac: cena koju plaća, oznaka na kartici, varijante koje mogu da se poruče. */
function toShopProduct(product: Product, categories: Category[], collections: Collection[]): ShopProduct {
    const tagCollection = TAG_COLLECTIONS.map((id) => collections.find((c) => c.id === id)).find(
      (collection) => collection?.productSlugs.includes(product.slug),
    );
    const onSale = isOnSale(product);
    const range = priceRange(product);
    return {
      id: product.slug,
      slug: product.slug,
      name: product.name,
      category: categories.find((category) => category.id === product.category)?.label ?? "",
      categoryId: product.category,
      // Proizvod iz podkategorije vidi se i u svim njenim nadkategorijama.
      categoryIds: [
        ...new Set(
          product.categories.flatMap((id) => categoryPath(categories, id).map((category) => category.id)),
        ),
      ],
      related: product.related,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      variant: product.summary,
      price: range.from as number,
      // Precrtana cena na kartici ima smisla samo kada sve varijante dele cenu proizvoda.
      ...(onSale && !range.varies ? { oldPrice: product.price as number } : {}),
      priceFrom: range.varies,
      lowStock: lowStockLabel(product),
      weight: product.weight ?? 0,
      image: product.image ?? null,
      tag: onSale ? `−${salePercent(product)}%` : (tagCollection?.name ?? ""),
      description: product.description,
      attributes: product.attributes,
      gallery: product.gallery,
      options: product.options,
      variants: product.variants
        .filter((variant) => variant.enabled)
        .map((variant) => {
          const available = isVariantAvailable(product, variant);
          return {
            id: variant.id,
            values: variant.values,
            label: variantLabel(variant),
            price: currentPrice(product, variant) ?? 0,
            ...(isOnSale(product, variant) ? { oldPrice: regularPrice(product, variant) as number } : {}),
            image: variant.image ?? null,
            available,
            maxQty: available ? maxQty(product, variant) : 0,
            lowStock: lowStockLabel(product, variant),
          };
        }),
      highlight: product.highlight,
      collections: collections
        .filter((collection) => collection.productSlugs.includes(product.slug))
        .map((collection) => collection.id),
    };
  }

/**
 * Traženi proizvodi koji mogu da se poruče (objavljeni, sa cenom i na stanju), redom kojim su
 * traženi, na jeziku stranice. Iz baze se čitaju samo oni, ne ceo katalog.
 */
export async function getShopProductsBySlugs(slugs: string[]): Promise<ShopProduct[]> {
  if (slugs.length === 0) return [];
  const [products, categories, collections] = await Promise.all([getProductsBySlugs(slugs), getCategories(), getCollections()]);
  const bySlug = new Map(products.filter(isAvailable).map((product) => [product.slug, toShopProduct(product, categories, collections)]));
  return translateForShop([...new Set(slugs)].flatMap((slug) => bySlug.get(slug) ?? []));
}

export async function getShopProduct(slug: string): Promise<ShopProduct | null> {
  return (await getShopProductsBySlugs([slug]))[0] ?? null;
}

/** Proizvodi koji prolaze filter, upitom u bazi (lib/listing.ts), u obliku za karticu, i koliko ih ukupno ima. */
export async function getShopList(filter: ListingFilter, limit: number): Promise<{ items: CardProduct[]; total: number }> {
  const { slugs, total } = await listSlugs(filter, limit);
  return { items: (await getShopProductsBySlugs(slugs)).map(toCardProduct), total };
}

/** Proizvodi za stranicu kolekcije: filteri, pretraga, redosled i strana iz adrese. */
export async function getListing(category: string, params: Record<string, string | string[] | undefined>): Promise<Listing<CardProduct>> {
  const [settings, rawFacets] = await Promise.all([getSettings(), listFacets(category)]);
  const query = parseListingQuery(params);
  // Kupac upisuje cenu u valuti, a u bazi je u najmanjim jedinicama.
  const unit = 10 ** settings.store.currencyDecimals;
  const filter: ListingFilter = {
    category,
    search: query.search,
    min: query.min === null ? null : query.min * unit,
    max: query.max === null ? null : query.max * unit,
    options: query.options,
    sort: query.sort,
  };
  let { items, total } = await getShopList(filter, query.page * PAGE_SIZE);
  // Strana preko kraja (stari link, u međuvremenu manje proizvoda) svodi se na poslednju.
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
  if (page !== query.page) ({ items, total } = await getShopList(filter, page * PAGE_SIZE));
  // Vrednost filtera ostaje na glavnom jeziku (po njoj baza traži); kupac vidi prevod.
  const labels = await translateForShop(rawFacets);
  const facets = rawFacets.map((facet, at) => ({
    name: facet.name,
    label: labels[at].name,
    values: facet.values.map((value, index) => ({ value, label: labels[at].values[index] })),
  }));
  return { query: { ...query, page }, items, total, facets };
}

/** Slični proizvodi: prvo ručno izabrani u panelu, pa iz iste kategorije, pa ostali. */
export async function getRelated(product: ShopProduct, limit = 4): Promise<CardProduct[]> {
  const picked = product.related.filter((slug) => slug !== product.slug).slice(0, limit);
  const same = product.categoryId ? (await listSlugs({ category: product.categoryId, exclude: [product.slug, ...picked] }, limit)).slugs : [];
  const rest = picked.length + same.length < limit ? (await listSlugs({ exclude: [product.slug, ...picked, ...same] }, limit)).slugs : [];
  return (await getShopProductsBySlugs([...picked, ...same, ...rest])).slice(0, limit).map(toCardProduct);
}

/**
 * Predlog u korpi do besplatne dostave: proizvod izabran u panelu, inače najjeftiniji iz
 * kataloga. Samo proizvod bez varijanti, jer se dodaje jednim klikom.
 */
export async function getUpsell(): Promise<CardProduct | null> {
  const wanted = (await getShopSettings()).templates.cart.upsell;
  const chosen = wanted ? await getShopProduct(wanted) : null;
  if (chosen && chosen.variants.length === 0) return toCardProduct(chosen);
  return (await getShopList({ simple: true, sort: "asc" }, 1)).items[0] ?? null;
}

/** Kategorije na jeziku stranice. */
export async function getShopCategories(): Promise<Category[]> {
  return translateForShop(await getCategories());
}

export async function getShopConfig(): Promise<ShopConfig> {
  const [settings, categories, lang] = await Promise.all([getShopSettings(), getShopCategories(), getShopLang()]);
  const { language, languages } = settings.store;
  return {
    lang,
    mainLang: language,
    // Izbor jezika na sajtu postoji samo kada prodavnica ima više od jednog.
    languages: languages.length > 0 ? [language, ...languages].map((code) => ({ code, name: langName(code) })) : [],
    storeName: settings.store.name,
    logo: settings.logo ?? null,
    menu: settings.site.menu,
    texts: settings.templates,
    categories: categoryTree(categories).map(({ category }) => ({
      id: category.id,
      label: category.label,
      parent: category.parent,
    })),
    analytics: settings.analytics,
    cartReminder: settings.abandoned.enabled,
    googleLogin: googleLoginReady(settings),
    shipping: settings.shipping.methods,
    payments: enabledPayments(settings, cardProvider(settings) !== null).map((id) => ({ id, label: paymentLabels[id] })),
  };
}

/** Kod dobrodošlice dok je aktivan u CRM-u (Popusti), inače null. */
export async function getWelcomeCode(): Promise<string | null> {
  const [discounts, settings] = await Promise.all([getDiscounts(), getSettings()]);
  const discount = discounts.find(
    (candidate) =>
      candidate.id === WELCOME_DISCOUNT_ID &&
      candidate.trigger === "public" &&
      candidate.status === "active",
  );
  return discount && !isExpired(discount, settings.store.timeZone) ? discount.code : null;
}
