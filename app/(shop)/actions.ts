"use server";

import { headers } from "next/headers";
import { checkCode, getOrders, submitOrder } from "@/lib/order-store";
import { validateCustomer, type OrderErrors } from "@/lib/orders";
import { clientIp, TOO_MANY, tooMany as countAttempt } from "@/lib/rate-limit";
import type { PaymentMethod } from "@/lib/settings";
import {
  checkUser,
  createUser,
  endSession,
  getCurrentUser,
  linkOrder,
  startSession,
} from "@/lib/storefront/auth";
import { clearCart, saveCart, unsubscribeCart } from "@/lib/abandoned";
import { getShopProducts, getWelcomeCode } from "@/lib/storefront/catalog";
import { getShopSettings, siteUrl } from "@/lib/storefront/pages";
import { addMessage, addSubscriber } from "@/lib/storefront/inbox";
import { CONTACT_TOPICS } from "./_components/topics";

/**
 * Akcije javne prodavnice. Poziva ih pregledač kupca, pa se ničemu što stigne
 * ne veruje: sve se proverava ovde, a cene i stanje računa CRM (lib/order-store.ts).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asText(value: unknown, max = 255): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asEmail(value: unknown): string | null {
  const email = asText(value, 191).toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

async function tooMany(kind: string, max: number): Promise<boolean> {
  return countAttempt(kind, clientIp(await headers()), max);
}

/* ---------- Nalog ---------- */

export type RegisterErrors = Partial<Record<"firstName" | "lastName" | "email" | "password", string>>;

export async function registerAction(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  news: boolean;
}): Promise<{ ok: true } | { ok: false; errors: RegisterErrors }> {
  const firstName = asText(input.firstName, 100);
  const lastName = asText(input.lastName, 100);
  const email = asEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";

  const errors: RegisterErrors = {};
  if (!firstName) errors.firstName = "Upišite ime.";
  if (!lastName) errors.lastName = "Upišite prezime.";
  if (!email) errors.email = "Upišite ispravnu email adresu.";
  if (password.length < 8) errors.password = "Lozinka mora imati najmanje 8 karaktera.";
  else if (password.length > 200) errors.password = "Lozinka je predugačka.";
  if (!email || Object.keys(errors).length > 0) return { ok: false, errors };
  if (await tooMany("register", 10)) return { ok: false, errors: { email: TOO_MANY } };

  const user = await createUser({ email, firstName, lastName, password });
  if (!user) {
    return { ok: false, errors: { email: "Nalog sa ovom adresom već postoji. Prijavite se." } };
  }
  if (input.news === true) await addSubscriber(email);
  await startSession(user.id, true);
  return { ok: true };
}

export async function loginAction(input: {
  email: string;
  password: string;
  remember: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await tooMany("login", 20)) return { ok: false, error: TOO_MANY };
  const email = asEmail(input.email);
  const password = typeof input.password === "string" ? input.password.slice(0, 200) : "";
  const user = email ? await checkUser(email, password) : null;
  if (!user) return { ok: false, error: "Pogrešna email adresa ili lozinka." };
  await startSession(user.id, input.remember === true);
  return { ok: true };
}

export async function logoutAction() {
  await endSession();
}

/* ---------- Novosti i kontakt ---------- */

export async function subscribeAction(
  input: string,
): Promise<{ ok: true; code: string | null } | { ok: false; error: string }> {
  const email = asEmail(input);
  if (!email) return { ok: false, error: "Upišite ispravnu email adresu." };
  if (await tooMany("subscribe", 10)) return { ok: false, error: TOO_MANY };
  await addSubscriber(email);
  return { ok: true, code: await getWelcomeCode() };
}

export type ContactErrors = Partial<Record<"name" | "email" | "text", string>>;

export async function contactAction(input: {
  name: string;
  email: string;
  topic: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; errors: ContactErrors }> {
  const name = asText(input.name);
  const email = asEmail(input.email);
  const body = asText(input.text, 5000);
  const topic = CONTACT_TOPICS.find((candidate) => candidate === input.topic) ?? CONTACT_TOPICS[0];

  const errors: ContactErrors = {};
  if (!name) errors.name = "Upišite ime i prezime.";
  if (!email) errors.email = "Upišite ispravnu email adresu.";
  if (!body) errors.text = "Upišite poruku.";
  if (!email || Object.keys(errors).length > 0) return { ok: false, errors };
  if (await tooMany("contact", 10)) return { ok: false, errors: { text: TOO_MANY } };

  await addMessage({ name, email, topic, body });
  return { ok: true };
}

/* ---------- Plaćanje ---------- */

export async function checkPromoAction(
  code: string,
): Promise<{ ok: true; code: string; percent: number } | { ok: false; message: string }> {
  if (await tooMany("promo", 40)) return { ok: false, message: TOO_MANY };
  const check = await checkCode(code);
  return check.ok ? { ok: true, ...check.discount } : { ok: false, message: "Ovaj kod ne važi." };
}

/**
 * Pamti korpu uz email sa stranice plaćanja, za podsetnik ako kupac ne poruči. Ne radi ništa
 * dok podsetnici nisu uključeni u panelu: bez toga se email ne čuva.
 */
export async function saveCartAction(input: {
  email: string;
  firstName: string;
  items: { slug: string; variantId?: string; qty: number }[];
}): Promise<void> {
  const settings = await getShopSettings();
  if (!settings.abandoned.enabled) return;
  const email = asEmail(input?.email);
  if (!email || (await tooMany("cart", 30))) return;
  const items = (Array.isArray(input.items) ? input.items.slice(0, 100) : []).flatMap((item) => {
    const qty = Number(item?.qty);
    if (typeof item?.slug !== "string" || !Number.isInteger(qty) || qty < 1) return [];
    return [{ slug: item.slug, qty, ...(typeof item.variantId === "string" ? { variant: item.variantId } : {}) }];
  });
  await saveCart({ email, firstName: asText(input.firstName, 100), items, siteUrl: await siteUrl() });
}

/** Odjava od podsetnika za korpu, sa linka u emailu. */
export async function unsubscribeCartAction(token: string): Promise<boolean> {
  if (await tooMany("unsubscribe", 30)) return false;
  return unsubscribeCart(token);
}

export type CheckoutField = "email" | "phone" | "firstName" | "lastName" | "address" | "city" | "zip" | "note";
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export type PlacedOrder = {
  number: string;
  firstName: string;
  subtotal: number;
  discount: number;
  promoCode: string;
  delivery: number;
  total: number;
  /** Naziv načina dostave i rečenica o isporuci (Podešavanja → Dostava). */
  deliveryMethod: string;
  deliveryNote: string;
  paymentMethod: PaymentMethod;
  /** Plaćanje karticom: adresa stranice procesora. */
  paymentUrl?: string;
  /** Podaci za uplatu iz CRM-a, kada je izabrana uplata na račun. */
  paymentInstructions: string;
};

export type PlaceOrderInput = {
  customer: Record<CheckoutField, string>;
  /** `variantId` je id varijante, kod proizvoda koji ih imaju. */
  items: { slug: string; variantId?: string; qty: number }[];
  promoCode: string;
  payment: string;
  /** Id izabranog načina dostave. */
  delivery: string;
};

const CUSTOMER_NOTE_MAX = 250;

/** Polja u CRM-u se zovu drugačije nego u formi prodavnice. */
function fromCrm(errors: OrderErrors): CheckoutErrors {
  const { name, street, postalCode, ...same } = errors;
  return {
    ...same,
    ...(name ? { firstName: name } : {}),
    ...(street ? { address: street } : {}),
    ...(postalCode ? { zip: postalCode } : {}),
  };
}

export async function placeOrderAction(
  input: PlaceOrderInput,
): Promise<{ ok: true; order: PlacedOrder } | { ok: false; errors: CheckoutErrors; message?: string }> {
  if (await tooMany("order", 10)) return { ok: false, errors: {}, message: TOO_MANY };

  const raw = (typeof input === "object" && input !== null ? input : {}) as Partial<PlaceOrderInput>;
  const customer = (raw.customer ?? {}) as Partial<Record<CheckoutField, unknown>>;
  const firstName = asText(customer.firstName, 100);
  const lastName = asText(customer.lastName, 100);
  const note = asText(customer.note, 1000);

  const errors: CheckoutErrors = {};
  if (!firstName) errors.firstName = "Upišite ime.";
  if (!lastName) errors.lastName = "Upišite prezime.";
  if (note.length > CUSTOMER_NOTE_MAX) {
    errors.note = `Napomena može imati najviše ${CUSTOMER_NOTE_MAX} znakova.`;
  }

  const products = await getShopProducts();
  const items = (Array.isArray(raw.items) ? raw.items.slice(0, 200) : []).flatMap((item) => {
    const product = products.find((candidate) => candidate.slug === item?.slug);
    const qty = Number(item?.qty);
    if (!product || !Number.isInteger(qty) || qty < 1) return [];
    return [{ slug: product.slug, qty, variant: asText(item.variantId, 120) || undefined }];
  });

  const crmCustomer = {
    name: `${firstName} ${lastName}`.trim(),
    phone: asText(customer.phone, 64),
    email: asText(customer.email, 300),
    street: asText(customer.address),
    city: asText(customer.city),
    postalCode: asText(customer.zip, 16),
    note: note.slice(0, CUSTOMER_NOTE_MAX),
  };
  // Ista pravila kao u CRM-u, pre upisa, da kupac sve greške vidi odjednom.
  const allErrors = { ...fromCrm(validateCustomer(crmCustomer)), ...errors };
  if (Object.keys(allErrors).length > 0) return { ok: false, errors: allErrors };

  const result = await submitOrder({
    customer: crmCustomer,
    items,
    discountCode: asText(raw.promoCode, 64),
    paymentMethod: asText(raw.payment, 20),
    deliveryMethod: asText(raw.delivery, 60),
  });
  if (!result.ok) return { ok: false, errors: fromCrm(result.errors), message: result.message };

  const user = await getCurrentUser();
  if (user) await linkOrder(user.id, result.orderNumber);
  // Kupac je poručio, pa mu podsetnik za korpu ne treba.
  await clearCart(crmCustomer.email);

  const saved = (await getOrders()).find((order) => order.number === result.orderNumber);
  return {
    ok: true,
    order: {
      number: result.orderNumber,
      firstName,
      subtotal: saved?.subtotal ?? result.total,
      discount: saved?.discount?.amount ?? 0,
      promoCode: saved?.discount?.code ?? "",
      delivery: saved?.delivery ?? 0,
      total: result.total,
      deliveryMethod: result.deliveryMethod,
      deliveryNote: result.deliveryNote,
      paymentMethod: result.paymentMethod,
      ...(result.paymentUrl ? { paymentUrl: result.paymentUrl } : {}),
      paymentInstructions: result.paymentInstructions ?? "",
    },
  };
}
