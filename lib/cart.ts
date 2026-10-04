import { currentPrice, isAvailable, stockLimit, type Product } from "@/lib/catalog";
import { discountAmount } from "@/lib/discounts";

export type CartItem = { slug: string; qty: number };
export type CartLine = { product: Product; qty: number };

export const MAX_QTY = 99;

/** Najveća količina jednog proizvoda u korpi: opšte ograničenje ili ono što je na stanju. */
export function maxQty(product: Product): number {
  return Math.min(stockLimit(product) ?? MAX_QTY, MAX_QTY);
}

/**
 * Spaja stavke korpe sa proizvodima. Stavke čiji proizvod više ne postoji ili
 * ne može da se poruči se preskaču, a količina se svodi na ono što je na stanju.
 */
export function toLines(items: CartItem[], products: Product[]): CartLine[] {
  return items.flatMap((item) => {
    const product = products.find((candidate) => candidate.slug === item.slug);
    if (!product || !isAvailable(product)) return [];
    return [{ product, qty: Math.min(item.qty, maxQty(product)) }];
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
    if (!isAvailable(product)) {
      return `„${product.name}" trenutno nije na stanju. Uklonite ga iz korpe pa potvrdite ponovo.`;
    }
    const limit = stockLimit(product);
    if (limit !== null && item.qty > limit) {
      return `Na stanju je još samo ${limit} kom. proizvoda „${product.name}". Smanjite količinu pa potvrdite ponovo.`;
    }
  }
  return null;
}

export function getSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + (currentPrice(line.product) ?? 0) * line.qty, 0);
}

/** Ukupna težina u gramima; proizvodi bez upisane težine se ne računaju. */
export function getWeight(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + (line.product.weight ?? 0) * line.qty, 0);
}

export type Pricing = {
  /** Zbir proizvoda. */
  subtotal: number;
  /** Popust; 0 kada kod nije upisan. */
  discount: number;
  delivery: number;
  total: number;
};

type PricingOptions = {
  /** Procenat popusta iz koda koji je kupac upisao. */
  discountPercent?: number;
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
  const discount = options.discountPercent ? discountAmount(subtotal, options.discountPercent) : 0;
  const paid = subtotal - discount;
  const free = options.freeShippingFrom !== null && paid >= options.freeShippingFrom;
  const delivery = free ? 0 : options.deliveryPrice;
  return { subtotal, discount, delivery, total: paid + delivery };
}
