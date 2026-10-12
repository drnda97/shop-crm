import type { CartLine } from "@/lib/cart";
import { currentPrice, inCategory, type Category } from "@/lib/catalog";

/**
 * Popusti. Tri načina na koja kupac dolazi do popusta:
 *
 * - „public": promo kod koji važi za svakog kupca, po želji sa brojem korišćenja i rokom.
 * - „auto": automatski popust — važi bez koda čim korpa ispuni uslov (najmanji iznos).
 * - „first" / „amount" / „weight": nagrada posle porudžbine. Kupac u emailu dobija kod za
 *   sledeću kupovinu; šalje se najjači aktivan popust čiji je uslov ispunjen. Taj kod važi za
 *   jednu kupovinu i samo za kupca kome je poslat (prepoznaje se po emailu ili telefonu).
 *
 * Promo kod i automatski popust mogu biti procenat, fiksni iznos ili besplatna dostava, i mogu
 * da važe samo za izabrane proizvode ili kategorije. Nagrade su uvek procenat na celu korpu.
 */

export type DiscountTrigger = "public" | "auto" | "first" | "amount" | "weight";
export type DiscountKind = "percent" | "amount" | "shipping";

/** Šta popust daje i na šta se odnosi. */
export type DiscountRule = {
  kind: DiscountKind;
  /** Popust u procentima, 1–100; koristi se kada je `kind` „percent". */
  percent: number;
  /** Fiksni iznos u najmanjim jedinicama valute; koristi se kada je `kind` „amount". */
  amount: number;
  /** Popust važi samo za ove proizvode (slug) i kategorije (id, sa podkategorijama). Oba prazna: cela korpa. */
  products: string[];
  categories: string[];
  /** „public" i „auto": najmanji zbir korpe za koji popust važi. Nagrade: prag (iznos ili grami). */
  threshold: number;
};

export type Discount = DiscountRule & {
  id: string;
  /** Naslov popusta; kupac ga vidi uz automatski popust i u emailu uz kod nagrade. */
  name: string;
  /** Kod. Obavezan za „public"; kod nagrada prazno znači nasumičan kod za svakog kupca. */
  code: string;
  /** Nacrt ne važi i ne šalje se. */
  status: "draft" | "active";
  trigger: DiscountTrigger;
  /** „public" i „auto": koliko porudžbina najviše može da ga iskoristi; null: bez ograničenja. */
  maxUses: number | null;
  /** „public" i „auto": poslednji dan važenja, "GGGG-MM-DD"; null: bez roka. */
  expiresAt: string | null;
};

export const triggerLabels: Record<DiscountTrigger, string> = {
  public: "Promo kod — važi za sve kupce",
  auto: "Automatski popust — bez koda",
  first: "Nagrada: posle prve porudžbine kupca",
  amount: "Nagrada: kada vrednost porudžbine pređe prag",
  weight: "Nagrada: kada težina porudžbine pređe prag (g)",
};

export const kindLabels: Record<DiscountKind, string> = {
  percent: "Procenat",
  amount: "Fiksni iznos",
  shipping: "Besplatna dostava",
};

/** Pravilo za procenat na celu korpu: stari zapisi i kodovi nagrada. */
export function percentRule(percent: number): DiscountRule {
  return { kind: "percent", percent, amount: 0, products: [], categories: [], threshold: 0 };
}

/** Popust primenjen na korpu: koliko se oduzima od proizvoda i da li je dostava besplatna. */
export type DiscountEffect = { amount: number; freeShipping: boolean };

/**
 * Šta pravilo daje za datu korpu, ili null kada ne važi: korpa je ispod najmanjeg iznosa, ili
 * u njoj nema proizvoda na koje se popust odnosi.
 */
export function applyRule(rule: DiscountRule, lines: CartLine[], categories: Category[]): DiscountEffect | null {
  const price = (line: CartLine) => (currentPrice(line.product, line.variant) ?? 0) * line.qty;
  const subtotal = lines.reduce((sum, line) => sum + price(line), 0);
  if (lines.length === 0 || subtotal < rule.threshold) return null;
  if (rule.kind === "shipping") return { amount: 0, freeShipping: true };

  const scoped = rule.products.length > 0 || rule.categories.length > 0;
  const base = lines
    .filter(
      (line) =>
        !scoped ||
        rule.products.includes(line.product.slug) ||
        rule.categories.some((id) => inCategory(line.product, id, categories)),
    )
    .reduce((sum, line) => sum + price(line), 0);
  if (base === 0) return null;
  // Fiksni iznos ne može da pređe vrednost proizvoda na koje se odnosi.
  const amount = rule.kind === "percent" ? discountAmount(base, rule.percent) : Math.min(rule.amount, base);
  return amount > 0 ? { amount, freeShipping: false } : null;
}

/** Popust koji je server primenio na korpu ili porudžbinu. */
export type AppliedDiscount = DiscountEffect & {
  /** Kod koji je kupac upisao; prazno kod automatskog popusta. */
  code: string;
  /** Naslov popusta, za ispis uz automatski popust. */
  label: string;
  /** Procenat, kada je popust procenat; inače null. */
  percent: number | null;
};

/** Kako se popust ispisuje kupcu i prodavcu: „Popust 10% (kod LETO10)", „Besplatna dostava — Jesen". */
export function discountText(discount: { code: string; percent: number | null; label?: string; freeShipping?: boolean }): string {
  const what = discount.freeShipping ? "Besplatna dostava" : `Popust${discount.percent ? ` ${discount.percent}%` : ""}`;
  if (discount.code) return `${what} (kod ${discount.code})`;
  return discount.label ? `${what} — ${discount.label}` : what;
}

export type OrderFacts = {
  /** Kupac (po emailu ili telefonu) do sada nije poručivao. */
  isFirstOrder: boolean;
  /** Vrednost proizvoda, posle popusta i bez dostave. */
  amount: number;
  /** Ukupna težina u gramima; proizvodi bez težine se ne računaju. */
  weight: number;
};

/** Najjača aktivna nagrada čiji je uslov ispunjen; kod istog procenta, ona koja je prva u spisku. */
export function pickDiscount(discounts: Discount[], facts: OrderFacts): Discount | null {
  let best: Discount | null = null;
  for (const discount of discounts) {
    if (discount.status !== "active" || discount.trigger === "public" || discount.trigger === "auto") continue;
    const met =
      discount.trigger === "first"
        ? facts.isFirstOrder
        : discount.trigger === "amount"
          ? facts.amount >= discount.threshold
          : facts.weight >= discount.threshold;
    if (met && (best === null || discount.percent > best.percent)) best = discount;
  }
  return best;
}

/** Koliko kupac uštedi popustom: iznos sa proizvoda, plus dostava ako je popust čini besplatnom. */
export function saving(effect: DiscountEffect, deliveryPrice: number): number {
  return effect.amount + (effect.freeShipping ? deliveryPrice : 0);
}

/** Rok je istekao kada je današnji dan (u zoni prodavnice) posle poslednjeg dana važenja. */
export function isExpired(discount: Discount, timeZone: string, now = new Date()): boolean {
  if (!discount.expiresAt) return false;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  return today > discount.expiresAt;
}

/** Iznos popusta, zaokružen na najmanju jedinicu valute. */
export function discountAmount(subtotal: number, percent: number): number {
  return Math.round((subtotal * percent) / 100);
}

/** Kod koji vlasnik upisuje: 3–32 znaka, slova bez kvačica, cifre i crtica. */
export function isValidCode(code: string): boolean {
  return /^[A-Z0-9-]{3,32}$/.test(code);
}

/** Kod se piše velikim slovima, bez razmaka — tako se i poredi. */
export function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}
