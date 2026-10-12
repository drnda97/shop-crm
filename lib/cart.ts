import {
  currentPrice,
  findVariant,
  isAvailable,
  isVariantAvailable,
  stockLimit,
  variantLabel,
  type Product,
  type Variant,
} from "@/lib/catalog";
import type { DiscountEffect } from "@/lib/discounts";

/** Stavka korpe kako je šalje sajt. `variant` je id varijante, kod proizvoda koji ih imaju. */
export type CartItem = { slug: string; qty: number; variant?: string };
export type CartLine = { product: Product; variant?: Variant; qty: number };

export const MAX_QTY = 99;

/** Najveća količina jednog proizvoda u korpi: opšte ograničenje ili ono što je na stanju. */
export function maxQty(product: Product, variant?: Variant): number {
  return Math.min(stockLimit(product, variant) ?? MAX_QTY, MAX_QTY);
}

/** Naziv stavke za poruke kupcu: „Fotelja Mio (Grafit, Orah)". */
function lineName(product: Product, variant?: Variant): string {
  return variant ? `${product.name} (${variantLabel(variant)})` : product.name;
}

/**
 * Spaja stavke korpe sa proizvodima. Stavke čiji proizvod ili varijanta više ne postoji ili
 * ne može da se poruči se preskaču, a količina se svodi na ono što je na stanju.
 * Proizvod sa varijantama ulazi u korpu samo uz izabranu varijantu.
 */
export function toLines(items: CartItem[], products: Product[]): CartLine[] {
  return items.flatMap((item) => {
    const product = products.find((candidate) => candidate.slug === item.slug);
    if (!product || !isAvailable(product)) return [];
    if (product.variants.length === 0) return [{ product, qty: Math.min(item.qty, maxQty(product)) }];
    const variant = findVariant(product, item.variant);
    if (!variant || !isVariantAvailable(product, variant)) return [];
    return [{ product, variant, qty: Math.min(item.qty, maxQty(product, variant)) }];
  });
}

/**
 * Za server, pre upisa porudžbine: poruka kupcu ako nečega iz korpe nema
 * dovoljno, ili null kada je sve na stanju.
 */
export function findStockProblem(items: CartItem[], products: Product[]): string | null {
  for (const item of items) {
    const product = products.find((candidate) => candidate.slug === item.slug);
    if (!product) continue;
    const variant = findVariant(product, item.variant);
    if (product.variants.length > 0 && !variant) {
      return `Izaberite opcije za „${product.name}" pa ga ponovo dodajte u korpu.`;
    }
    const name = lineName(product, variant);
    if (!isAvailable(product) || (variant && !isVariantAvailable(product, variant))) {
      return `„${name}" trenutno nije na stanju. Uklonite ga iz korpe pa potvrdite ponovo.`;
    }
    const limit = stockLimit(product, variant);
    if (limit !== null && item.qty > limit) {
      return `Na stanju je još samo ${limit} kom. proizvoda „${name}". Smanjite količinu pa potvrdite ponovo.`;
    }
  }
  return null;
}

export function getSubtotal(lines: CartLine[]): number {
  return lines.reduce(
    (sum, line) => sum + (currentPrice(line.product, line.variant) ?? 0) * line.qty,
    0,
  );
}

/** Ukupna težina u gramima; proizvodi bez upisane težine se ne računaju. */
export function getWeight(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + (line.product.weight ?? 0) * line.qty, 0);
}

export type Pricing = {
  /** Zbir proizvoda. */
  subtotal: number;
  /** Popust oduzet od proizvoda; 0 kada ga nema ili kada je popust besplatna dostava. */
  discount: number;
  delivery: number;
  total: number;
};

type PricingOptions = {
  /** Popust koji je server primenio (kod ili automatski): iznos sa proizvoda i besplatna dostava. */
  discount?: DiscountEffect | null;
  deliveryPrice: number;
  /** Vrednost od koje je dostava besplatna; null kada je besplatna dostava isključena. */
  freeShippingFrom: number | null;
};

/**
 * Obračun porudžbine. Isti je za korpu (API) i pri upisu porudžbine: popust se
 * oduzima od zbira proizvoda, a prag za besplatnu dostavu gleda iznos posle popusta.
 */
export function getPricing(lines: CartLine[], options: PricingOptions): Pricing {
  const subtotal = getSubtotal(lines);
  const discount = Math.min(options.discount?.amount ?? 0, subtotal);
  const paid = subtotal - discount;
  const free =
    options.discount?.freeShipping === true ||
    (options.freeShippingFrom !== null && paid >= options.freeShippingFrom);
  const delivery = free ? 0 : options.deliveryPrice;
  return { subtotal, discount, delivery, total: paid + delivery };
}
