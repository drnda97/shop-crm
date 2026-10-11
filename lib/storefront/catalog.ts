import { currentPrice, isAvailable, isOnSale, salePercent } from "@/lib/catalog";
import { getCategories, getCollections, getDiscounts, getProducts, getSettings } from "@/lib/content";
import { getShopSettings } from "@/lib/storefront/pages";
import { isExpired } from "@/lib/discounts";
import { enabledPayments, paymentLabels } from "@/lib/settings";
import type { ShopConfig, ShopProduct } from "@/lib/storefront/products";

/**
 * Javna prodavnica čita katalog i podešavanja iz CRM-a, direktno iz baze
 * (isti proces, bez poziva API-ja). Samo za server.
 */

/** Kolekcije čiji naziv postaje oznaka na kartici proizvoda; prva u kojoj je proizvod pobeđuje. */
const TAG_COLLECTIONS = ["bestseler", "novo"];

/** Promo kod koji prodavnica obećava u prijavi na novosti i pri registraciji. */
const WELCOME_DISCOUNT_ID = "dobrodoslica";

/** Proizvodi koji mogu da se poruče: objavljeni, sa cenom i na stanju. */
export async function getShopProducts(): Promise<ShopProduct[]> {
  const [products, categories, collections] = await Promise.all([
    getProducts(),
    getCategories(),
    getCollections(),
  ]);

  return products.filter(isAvailable).map((product) => {
    const tagCollection = TAG_COLLECTIONS.map((id) => collections.find((c) => c.id === id)).find(
      (collection) => collection?.productSlugs.includes(product.slug),
    );
    const onSale = isOnSale(product);
    return {
      id: product.slug,
      slug: product.slug,
      name: product.name,
      category: categories.find((category) => category.id === product.category)?.label ?? "",
      variant: product.summary,
      price: currentPrice(product) as number,
      ...(onSale ? { oldPrice: product.price as number } : {}),
      image: product.image ?? null,
      tag: onSale ? `−${salePercent(product)}%` : (tagCollection?.name ?? ""),
      description: product.description,
      attributes: product.attributes,
      gallery: product.gallery,
      options: product.options,
      highlight: product.highlight,
      collections: collections
        .filter((collection) => collection.productSlugs.includes(product.slug))
        .map((collection) => collection.id),
    };
  });
}

export async function getShopConfig(): Promise<ShopConfig> {
  const [settings, categories] = await Promise.all([getShopSettings(), getCategories()]);
  const { shipping } = settings;
  return {
    storeName: settings.store.name,
    logo: settings.logo ?? null,
    menu: settings.site.menu,
    texts: settings.templates,
    categories: ["Sve", ...categories.map((category) => category.label)],
    shippingPrice: shipping.price,
    freeFrom: shipping.freeEnabled ? shipping.freeFrom : null,
    pickup: shipping.pickupEnabled,
    payments: enabledPayments(settings).map((id) => ({ id, label: paymentLabels[id] })),
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
