/**
 * Popusti. Dve vrste:
 *
 * - „public": običan promo kod koji važi za svakog kupca, po želji sa brojem
 *   korišćenja i rokom.
 * - „first" / „amount" / „weight": nagrada posle porudžbine. Kupac u emailu
 *   dobija kod za sledeću kupovinu; šalje se najjači aktivan popust čiji je
 *   uslov ispunjen. Taj kod važi za jednu kupovinu i samo za kupca kome je
 *   poslat (prepoznaje se po emailu ili telefonu).
 */

export type DiscountTrigger = "public" | "first" | "amount" | "weight";

export type Discount = {
  id: string;
  /** Naslov popusta; kod nagrada ga kupac vidi u emailu uz kod. */
  name: string;
  /** Kod. Obavezan za „public"; kod nagrada prazno znači nasumičan kod za svakog kupca. */
  code: string;
  /** Popust u procentima, 1–100. */
  percent: number;
  /** Nacrt ne važi i ne šalje se. */
  status: "draft" | "active";
  trigger: DiscountTrigger;
  /** Prag: iznos za "amount", grami za "weight"; inače se ne koristi. */
  threshold: number;
  /** Samo „public": koliko porudžbina najviše može da ga iskoristi; null: bez ograničenja. */
  maxUses: number | null;
  /** Samo „public": poslednji dan važenja, "GGGG-MM-DD"; null: bez roka. */
  expiresAt: string | null;
};

export const triggerLabels: Record<DiscountTrigger, string> = {
  public: "Promo kod — važi za sve kupce",
  first: "Nagrada: posle prve porudžbine kupca",
  amount: "Nagrada: kada vrednost porudžbine pređe prag",
  weight: "Nagrada: kada težina porudžbine pređe prag (g)",
};

/** Kod koji je kupac upisao u korpi i koji je server potvrdio. */
export type AppliedDiscount = { code: string; percent: number };

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
    if (discount.status !== "active" || discount.trigger === "public") continue;
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
