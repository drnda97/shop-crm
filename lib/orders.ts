import { MAX_QTY, type CartItem } from "@/lib/cart";
import { normalizeCode } from "@/lib/discounts";
import type { PaymentMethod } from "@/lib/settings";

export type OrderCustomer = {
  name: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  postalCode: string;
  note: string;
};

export type OrderInput = {
  customer: OrderCustomer;
  items: CartItem[];
  /** Kod za popust koji je kupac upisao; prazan ako ga nema. */
  discountCode: string;
  /** Način plaćanja koji je kupac izabrao; prazan znači prvi uključen. */
  paymentMethod: string;
  /** Id načina dostave (Podešavanja → Dostava); prazno: prvi koji važi za adresu. "pickup": lično preuzimanje. */
  deliveryMethod: string;
};

export type CustomerField = keyof OrderCustomer;
export type OrderErrors = Partial<Record<CustomerField, string>>;

export type OrderResult =
  | {
      ok: true;
      orderNumber: string;
      total: number;
      paymentMethod: PaymentMethod;
      /** Podaci za uplatu, kada je izabrana uplata na račun. */
      paymentInstructions?: string;
      /** Naziv izabranog načina dostave i rečenica o isporuci koju kupac vidi posle porudžbine. */
      deliveryMethod: string;
      deliveryNote: string;
      /** Plaćanje karticom: adresa stranice procesora na koju sajt šalje kupca. */
      paymentUrl?: string;
    }
  | { ok: false; errors: OrderErrors; message?: string };

export type OrderStatus = "new" | "confirmed" | "shipped" | "delivered" | "cancelled";

export const orderStatusLabels: Record<OrderStatus, string> = {
  new: "Nova",
  confirmed: "Potvrđena",
  shipped: "Poslata",
  delivered: "Isporučena",
  cancelled: "Otkazana",
};

/** Sačuvana porudžbina. Naziv i cena stavke su prepis iz trenutka poručivanja. */
export type Order = {
  number: string;
  receivedAt: string;
  status: OrderStatus;
  /** Po ovome se porudžbine istog kupca spajaju u delu Kupci. */
  customerKey: string;
  customer: OrderCustomer;
  /** `variant` je naziv izabrane varijante („Grafit, Orah"), ili prazno; `returned`: koliko je komada kupac vratio. */
  items: { slug: string; name: string; variant: string; sku: string; qty: number; price: number; returned: number }[];
  paymentMethod: PaymentMethod;
  /** Naziv načina dostave koji je kupac izabrao; `pickup`: preuzima sam. */
  deliveryMethod: string;
  pickup: boolean;
  /** Broj pošiljke i adresa za praćenje, kada ih prodavac upiše. */
  tracking?: { number: string; url: string };
  /** Kada je uplata stigla (kartica odmah, uplata na račun kada je prodavac označi). */
  paidAt?: string;
  /** Oznaka transakcije kod procesora kartica. */
  paymentRef?: string;
  /** Ukupno vraćeno kupcu. */
  refunded: number;
  /** Stopa PDV-a u trenutku poručivanja; null kada prodavnica nije u sistemu PDV-a. */
  taxPercent: number | null;
  subtotal: number;
  delivery: number;
  total: number;
  /** Popust iskorišćen u ovoj porudžbini. */
  discount?: { code: string; percent: number; amount: number };
  /** Kod poslat kupcu uz ovu porudžbinu, za sledeću kupovinu. */
  issuedCode?: { code: string; percent: number; title: string };
  /** Zašto email o porudžbini nije poslat; nema ga kada je sve prošlo. */
  emailError?: string;
  /** Beleška prodavca; kupac je ne vidi. */
  adminNote?: string;
};

export type OrderEvent = { at: string; text: string };

/** PDV sadržan u iznosu koji već uključuje PDV (cene u prodavnici su sa PDV-om). */
export function includedTax(amount: number, percent: number): number {
  return Math.round((amount * percent) / (100 + percent));
}

/** Koliko još može da se vrati kupcu. */
export function refundable(order: { total: number; refunded: number }): number {
  return Math.max(0, order.total - order.refunded);
}

/** Naziv stavke sa izabranom varijantom: „Fotelja Mio — Grafit, Orah". */
export function itemName(item: { name: string; variant: string }): string {
  return item.variant ? `${item.name} — ${item.variant}` : item.name;
}

/** Broj telefona sveden na cifre, bez pozivnog i početne nule, da se isti broj prepozna u svakom zapisu. */
export function phoneDigits(phone: string, prefix: string): string {
  let digits = phone.replace(/\D/g, "").replace(/^00/, "");
  const country = prefix.replace(/\D/g, "");
  if (country && digits.startsWith(country)) digits = digits.slice(country.length);
  return digits.replace(/^0+/, "");
}

/** Ključ kupca: telefon ako ga ima, inače email. Sadrži samo znakove bezbedne za adresu. */
export function customerKey(customer: { phone: string; email: string }, prefix: string): string {
  const digits = phoneDigits(customer.phone, prefix);
  if (digits) return `t${digits}`;
  return `e${Buffer.from(customer.email.trim().toLowerCase()).toString("base64url")}`;
}

/** Pravila za podatke kupca; ista važe za svaku porudžbinu, sa bilo kog sajta. */
export function validateCustomer(customer: OrderCustomer): OrderErrors {
  const errors: OrderErrors = {};

  if (customer.name.trim().length < 2) {
    errors.name = "Upišite ime i prezime.";
  }

  const digits = customer.phone.replace(/\D/g, "");
  if (customer.phone.trim() === "") {
    errors.phone = "Upišite broj telefona.";
  } else if (
    !/^[+\d\s/().-]+$/.test(customer.phone.trim()) ||
    digits.length < 6 ||
    digits.length > 15
  ) {
    errors.phone = "Proverite broj telefona.";
  }

  const email = customer.email.trim();
  if (email === "") {
    errors.email = "Upišite email adresu.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    errors.email = "Proverite email adresu.";
  }

  if (customer.street.trim().length < 3) {
    errors.street = "Upišite ulicu i broj.";
  }

  if (customer.city.trim().length < 2) {
    errors.city = "Upišite mesto.";
  }

  if (customer.postalCode.trim() === "") {
    errors.postalCode = "Upišite poštanski broj.";
  } else if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/.test(customer.postalCode.trim())) {
    errors.postalCode = "Proverite poštanski broj.";
  }

  if (customer.note.length > 500) {
    errors.note = "Napomena može imati najviše 500 znakova.";
  }

  return errors;
}

function asText(value: unknown, max = 255): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Podaci stižu sa tuđeg sajta, pa im se ne veruje: sve se čita i proverava iznova. */
export function parseOrder(input: unknown): OrderInput {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const rawCustomer = (
    typeof raw.customer === "object" && raw.customer !== null ? raw.customer : {}
  ) as Record<string, unknown>;

  const customer: OrderCustomer = {
    name: asText(rawCustomer.name),
    phone: asText(rawCustomer.phone, 64),
    email: asText(rawCustomer.email, 300),
    street: asText(rawCustomer.street),
    city: asText(rawCustomer.city),
    postalCode: asText(rawCustomer.postalCode, 16),
    note: asText(rawCustomer.note, 501),
  };

  return {
    customer,
    items: parseItems(raw.items),
    discountCode: normalizeCode(asText(raw.discountCode, 64)),
    paymentMethod: asText(raw.paymentMethod, 20),
    deliveryMethod: asText(raw.deliveryMethod, 20),
  };
}

/** Stavke korpe iz zahteva; neispravne se preskaču, a ista stavka (proizvod i varijanta) se sabira. */
export function parseItems(input: unknown): CartItem[] {
  const items = new Map<string, CartItem>();
  for (const entry of Array.isArray(input) ? input.slice(0, 200) : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const { slug, qty, variant } = entry as Record<string, unknown>;
    if (typeof slug !== "string" || typeof qty !== "number") continue;
    if (!Number.isInteger(qty) || qty < 1) continue;
    const id = typeof variant === "string" && /^[a-z0-9-]{1,120}$/.test(variant) ? variant : undefined;
    // Razmak ne može biti deo oznake, pa ključ ne može da se poklopi sa drugom stavkom.
    const key = `${slug} ${id ?? ""}`;
    const total = Math.min((items.get(key)?.qty ?? 0) + qty, MAX_QTY);
    items.set(key, { slug, qty: total, ...(id ? { variant: id } : {}) });
  }
  return [...items.values()];
}
