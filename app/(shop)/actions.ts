"use server";

import { getShopLang, getShopPath, getShopT } from "@/lib/i18n/server";
import { headers } from "next/headers";
import { toLines } from "@/lib/cart";
import { getProductsBySlugs } from "@/lib/content";
import { discountText } from "@/lib/discounts";
import { addOrderEvent, getOrder, getOrders, quoteCart, submitOrder } from "@/lib/order-store";
import { availableMethods } from "@/lib/shipping";
import { itemName, orderStatusLabels, validateCustomer, type Order, type OrderErrors } from "@/lib/orders";
import { clientIp, TOO_MANY, tooMany as countAttempt } from "@/lib/rate-limit";
import type { PaymentMethod } from "@/lib/settings";
import {
  checkUser,
  createPasswordReset,
  createUser,
  deleteUser,
  endSession,
  getCurrentUser,
  getUserOrders,
  linkOrder,
  resetPassword,
  saveAddress,
  startSession,
  type ShopAddress,
} from "@/lib/storefront/auth";
import { getDb } from "@/lib/db";
import { isMailReady, sendMails, simpleEmail } from "@/lib/mail";
import { unsubscribeNewsletter } from "@/lib/newsletter";
import { addReturnRequest, getOrderReturns, returnStatusLabels } from "@/lib/returns";
import { saveReview } from "@/lib/reviews";
import { clearCart, saveCart, unsubscribeCart } from "@/lib/abandoned";
import { getShopProductsBySlugs, getWelcomeCode } from "@/lib/storefront/catalog";
import { toCardProduct, type CardProduct } from "@/lib/storefront/products";
import { getShopSettings, siteUrl } from "@/lib/storefront/pages";
import { addMessage, addSubscriber } from "@/lib/storefront/inbox";

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

const MAIL_OFF = "Slanje emaila trenutno nije dostupno. Javite nam se preko kontakt forme.";

/**
 * Zahtev za novu lozinku. Odgovor je isti bez obzira na to da li nalog postoji, da forma ne
 * otkrije koje su adrese registrovane.
 */
export async function requestResetAction(input: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = asEmail(input);
  if (!email) return { ok: false, error: "Upišite ispravnu email adresu." };
  if (await tooMany("reset", 5)) return { ok: false, error: TOO_MANY };
  const settings = await getShopSettings();
  if (!isMailReady(settings)) return { ok: false, error: MAIL_OFF };
  const reset = await createPasswordReset(email);
  if (reset) {
    const url = `${await siteUrl()}${(await getShopPath())(`/nalog/lozinka/${reset.token}`)}`;
    const t = await getShopT();
    const { errors } = await sendMails(settings, [
      {
        to: reset.user.email,
        subject: `${t("Nova lozinka")} — ${settings.store.name}`,
        ...simpleEmail(settings, {
          message: t("Zdravo {ime}, tražili ste novu lozinku za svoj nalog. Link važi jedan sat.\n\nAko to niste bili vi, ne morate ništa da radite: lozinka ostaje ista.", { ime: reset.user.firstName }),
          button: { label: t("Postavite novu lozinku"), url },
        }),
      },
    ]);
    if (errors.length > 0) console.error(`[nova lozinka] ${errors[0]}`);
  }
  return { ok: true };
}

export async function resetPasswordAction(token: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await tooMany("reset-set", 10)) return { ok: false, error: TOO_MANY };
  if (typeof password !== "string" || password.length < 8) return { ok: false, error: "Lozinka mora imati najmanje 8 karaktera." };
  if (password.length > 200) return { ok: false, error: "Lozinka je predugačka." };
  const done = await resetPassword(asText(token, 100), password);
  return done ? { ok: true } : { ok: false, error: "Link više ne važi. Zatražite novi." };
}

export type AddressErrors = Partial<Record<keyof ShopAddress, string>>;

/** Adresa za dostavu uz nalog; popunjava formu pri sledećoj porudžbini. Prazna polja su dozvoljena. */
export async function saveAddressAction(input: ShopAddress): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Prijavite se ponovo." };
  await saveAddress(user.id, {
    phone: asText(input?.phone, 64),
    street: asText(input?.street),
    city: asText(input?.city),
    postalCode: asText(input?.postalCode, 16),
  });
  return { ok: true };
}

/** Kupac briše svoj nalog. Porudžbine ostaju prodavcu; njihovo brisanje kupac traži od prodavca. */
export async function deleteAccountAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await deleteUser(user.id);
  await endSession();
}

/* ---------- Praćenje porudžbine i povrat ---------- */

export type OrderView = {
  number: string;
  date: string;
  status: string;
  deliveryMethod: string;
  tracking: { number: string; url: string } | null;
  total: number;
  refunded: number;
  items: { position: number; name: string; qty: number; returnable: number }[];
  /** Može da se zatraži povrat: porudžbina je poslata ili isporučena, ima šta da se vrati i nema zahteva koji čeka. */
  canReturn: boolean;
  returns: { date: string; status: string; items: string; answer: string }[];
};

/**
 * Porudžbina za kupca: po broju i email adresi sa kojom je poručena, ili po nalogu sa kog je
 * poručena. Pogrešan broj i pogrešna adresa daju isti odgovor.
 */
async function findCustomerOrder(number: string, email: string): Promise<Order | null> {
  const order = await getOrder(asText(number, 12).replace(/^#/, ""));
  if (!order) return null;
  const user = await getCurrentUser();
  if (user && (await getUserOrders(user.id)).some((candidate) => candidate.number === order.number)) return order;
  const given = asEmail(email);
  return given && order.customer.email.toLowerCase() === given ? order : null;
}

async function toOrderView(order: Order): Promise<OrderView> {
  const [settings, returns] = await Promise.all([getShopSettings(), getOrderReturns(order.number)]);
  const date = new Intl.DateTimeFormat(settings.store.locale, { dateStyle: "long", timeZone: settings.store.timeZone });
  const items = order.items.map((item, position) => ({ position, name: itemName(item), qty: item.qty, returnable: item.qty - item.returned }));
  return {
    number: order.number,
    date: date.format(new Date(order.receivedAt)),
    status: orderStatusLabels[order.status],
    deliveryMethod: order.deliveryMethod,
    tracking: order.tracking ?? null,
    total: order.total,
    refunded: order.refunded,
    items,
    canReturn:
      settings.payment.returns &&
      (order.status === "shipped" || order.status === "delivered") &&
      items.some((item) => item.returnable > 0) &&
      !returns.some((request) => request.status === "new"),
    returns: returns.map((request) => ({
      date: date.format(new Date(request.createdAt)),
      status: returnStatusLabels[request.status],
      items: request.items.map((item) => `${item.qty} × ${item.name}`).join(", "),
      answer: request.answer,
    })),
  };
}

const NOT_FOUND = "Nismo našli porudžbinu sa tim brojem i email adresom.";

export async function trackOrderAction(input: { number: string; email: string }): Promise<{ ok: true; order: OrderView } | { ok: false; error: string }> {
  if (await tooMany("track", 20)) return { ok: false, error: TOO_MANY };
  const order = await findCustomerOrder(input?.number, input?.email);
  return order ? { ok: true, order: await toOrderView(order) } : { ok: false, error: NOT_FOUND };
}

/** Zahtev za povrat: šta kupac vraća i zašto. Prodavac odgovara iz panela, a kupac odgovor dobija emailom. */
export async function returnRequestAction(input: {
  number: string;
  email: string;
  items: { position: number; qty: number }[];
  reason: string;
}): Promise<{ ok: true; order: OrderView } | { ok: false; error: string }> {
  if (await tooMany("return", 10)) return { ok: false, error: TOO_MANY };
  const order = await findCustomerOrder(input?.number, input?.email);
  if (!order) return { ok: false, error: NOT_FOUND };
  const view = await toOrderView(order);
  if (!view.canReturn) return { ok: false, error: "Za ovu porudžbinu trenutno ne može da se zatraži povrat." };

  const reason = asText(input.reason, 1000);
  if (reason.length < 5) return { ok: false, error: "Napišite zašto vraćate proizvod." };
  const items = (Array.isArray(input.items) ? input.items : []).flatMap((entry) => {
    const item = view.items.find((candidate) => candidate.position === entry?.position);
    const qty = Math.min(Math.round(Number(entry?.qty) || 0), item?.returnable ?? 0);
    return item && qty > 0 ? [{ name: item.name, qty }] : [];
  });
  if (items.length === 0) return { ok: false, error: "Označite šta vraćate." };

  await addReturnRequest(order.number, items, reason);
  await addOrderEvent(await getDb(), order.number, `Kupac je zatražio povrat: ${items.map((item) => `${item.qty} × ${item.name}`).join(", ")}`);
  return { ok: true, order: await toOrderView(order) };
}

/* ---------- Utisci ---------- */

/** Utisak o proizvodu: piše ga prijavljen kupac, a na sajtu se vidi kada ga prodavac odobri. */
export async function reviewAction(input: { slug: string; rating: number; text: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Prijavite se da biste ostavili utisak." };
  if (await tooMany("review", 10)) return { ok: false, error: TOO_MANY };
  const rating = Math.round(Number(input?.rating));
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Izaberite ocenu od 1 do 5." };
  const body = asText(input.text, 2000);
  if (body.length < 10) return { ok: false, error: "Napišite bar jednu rečenicu." };
  const product = (await getProductsBySlugs([asText(input.slug, 191)])).find((candidate) => candidate.active);
  if (!product) return { ok: false, error: "Proizvod više ne postoji." };

  const orders = await getUserOrders(user.id);
  await saveReview({
    productSlug: product.slug,
    userId: user.id,
    // Na sajtu se vidi ime i početno slovo prezimena.
    name: `${user.firstName} ${user.lastName.slice(0, 1)}.`.trim(),
    rating,
    body,
    verified: orders.some((order) => order.status !== "cancelled" && order.items.some((item) => item.slug === product.slug)),
  });
  return { ok: true };
}

/** Odjava od novosti, sa linka u emailu. */
export async function unsubscribeNewsletterAction(token: string): Promise<boolean> {
  if (await tooMany("unsubscribe", 30)) return false;
  return unsubscribeNewsletter(token);
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

/* ---------- Proizvodi za korpu i listu želja ---------- */

/**
 * Proizvodi po oznaci, u obliku za karticu: korpa i lista želja u pregledaču pamte samo oznake,
 * a nazive, cene i slike traže ovde. Vraća samo proizvode koji mogu da se poruče.
 */
export async function cartProductsAction(slugs: string[]): Promise<CardProduct[]> {
  const wanted = (Array.isArray(slugs) ? slugs : []).filter((slug) => typeof slug === "string" && slug.length <= 191).slice(0, 200);
  return (await getShopProductsBySlugs(wanted)).map(toCardProduct);
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
  // Teme upisuje vlasnik u sekciji Kontakt, pa se ovde ne porede sa spiskom.
  const topic = asText(input.topic, 120);

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

export type CartQuote = {
  subtotal: number;
  discount: number;
  /** Kako se popust ispisuje („Popust 10% (kod LETO10)"), ili prazno kada ga nema. */
  discountText: string;
  delivery: number;
  total: number;
  /** Poruka kada upisani kod ne važi. */
  codeError: string;
};

/**
 * Obračun za stranicu plaćanja: cene, popust (upisani kod ili automatski) i dostava izabranim
 * načinom. Računa server, po istim pravilima po kojima se porudžbina upisuje.
 */
export async function quoteAction(input: {
  items: { slug: string; variantId?: string; qty: number }[];
  promoCode: string;
  delivery: string;
  zip: string;
}): Promise<CartQuote | null> {
  if (await tooMany("quote", 240)) return null;
  const items = (Array.isArray(input?.items) ? input.items.slice(0, 100) : []).flatMap((item) => {
    const qty = Number(item?.qty);
    if (typeof item?.slug !== "string" || !Number.isInteger(qty) || qty < 1) return [];
    return [{ slug: item.slug, qty, ...(typeof item.variantId === "string" ? { variant: item.variantId } : {}) }];
  });
  const [products, settings] = await Promise.all([getProductsBySlugs(items.map((item) => item.slug)), getShopSettings()]);
  const methods = availableMethods(settings.shipping.methods, asText(input.zip, 16));
  const method = methods.find((candidate) => candidate.id === input.delivery) ?? methods[0];
  // Proveru koda ograničava isti brojač kao i ranije: nagađanje kodova kroz obračun ne prolazi.
  const code = asText(input.promoCode, 64);
  if (code && (await tooMany("promo", 40))) return null;
  const { pricing, discount, codeError } = await quoteCart(toLines(items, products), code, method);
  return {
    ...pricing,
    discountText: discount ? discountText(discount) : "",
    codeError: codeError ?? "",
  };
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
  await saveCart({ email, firstName: asText(input.firstName, 100), items, siteUrl: await siteUrl(), lang: await getShopLang() });
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
  /** Kako se popust ispisuje („Popust 10% (kod LETO10)"), ili prazno. */
  discountText: string;
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

  const wanted = Array.isArray(raw.items) ? raw.items.slice(0, 200) : [];
  const products = await getShopProductsBySlugs(wanted.flatMap((item) => (typeof item?.slug === "string" ? [item.slug] : [])));
  const items = wanted.flatMap((item) => {
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
  if (user) {
    await linkOrder(user.id, result.orderNumber);
    // Adresa iz porudžbine ostaje uz nalog, za sledeću kupovinu.
    await saveAddress(user.id, { phone: crmCustomer.phone, street: crmCustomer.street, city: crmCustomer.city, postalCode: crmCustomer.postalCode });
  }
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
      discountText: saved?.discount ? discountText(saved.discount) : "",
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
