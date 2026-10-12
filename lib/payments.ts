import { createHmac, timingSafeEqual } from "node:crypto";
import { getSecret } from "@/lib/admin-auth";
import type { Settings } from "@/lib/settings";

/**
 * Plaćanje karticom: zajednički sloj za procesore. Prodavnica radi i bez ijednog — tada se
 * kartica ne nudi kupcu. Onaj ko ima ugovor sa bankom ili procesorom dopisuje svoj procesor
 * ovde (objekat tipa PaymentProvider u spisku PAYMENT_PROVIDERS) i bira ga u Podešavanjima.
 *
 * Tok: kupac potvrdi porudžbinu → start() vrati adresu stranice procesora → kupac plati →
 * procesor vrati kupca (ili sam pozove) na /api/v1/payments/{id} → confirm() pročita ishod →
 * porudžbina se označi kao plaćena. Samo za server.
 */

export type PaymentRequest = {
  orderNumber: string;
  /** Iznos u najmanjim jedinicama valute. */
  amount: number;
  currency: string;
  customerEmail: string;
  /** Adresa na koju procesor vraća kupca i šalje potvrdu: /api/v1/payments/{id}. */
  callbackUrl: string;
};

export type PaymentStart = { ok: true; redirectUrl: string } | { ok: false; error: string };

export type PaymentConfirmation = {
  orderNumber: string;
  paid: boolean;
  /** Oznaka transakcije kod procesora, za evidenciju i povraćaj. */
  reference: string;
};

export type PaymentProvider = {
  id: string;
  label: string;
  /** Da li je procesor povezan (upisani ključevi i slično). Dok nije, kartica se ne nudi. */
  ready(): boolean;
  /** Pokreće plaćanje i vraća adresu na koju se kupac šalje. */
  start(request: PaymentRequest): Promise<PaymentStart>;
  /**
   * Čita potvrdu procesora iz zahteva na callbackUrl (povratak kupca ili poziv banke) i
   * proverava njen potpis. null: zahtev nije ispravna potvrda.
   */
  confirm(request: Request): Promise<PaymentConfirmation | null>;
  /**
   * Vraća novac na karticu kupca. Neobavezno: procesor koji to ne ume izostavlja funkciju,
   * pa prodavac vraća novac sam, a panel beleži samo evidenciju.
   */
  refund?(reference: string, amount: number): Promise<{ ok: true } | { ok: false; error: string }>;
};

/* ---------- Probni procesor ---------- */

/** Potpis probne uplate tajnom servera: bez njega niko spolja ne može da označi porudžbinu kao plaćenu. */
export async function signPayment(orderNumber: string, outcome: string): Promise<string> {
  return createHmac("sha256", `shopcrm-payment:${await getSecret()}`).update(`${orderNumber}:${outcome}`).digest("hex");
}

async function validSignature(orderNumber: string, outcome: string, signature: string): Promise<boolean> {
  const expected = Buffer.from(await signPayment(orderNumber, outcome));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Probni procesor: umesto banke prikazuje stranicu sa dugmadima „Uplati" i „Odbij". Služi da se
 * ceo tok proveri pre povezivanja pravog procesora. Uključuje se promenljivom CARD_TEST_PROVIDER=1
 * i ne sme da ostane uključen na pravoj prodavnici: ne naplaćuje ništa.
 */
const testProvider: PaymentProvider = {
  id: "test",
  label: "Probni procesor (ne naplaćuje)",
  ready: () => process.env.CARD_TEST_PROVIDER === "1",
  async start({ orderNumber, amount, callbackUrl }) {
    const page = new URL("/placanje/proba-kartice", callbackUrl);
    page.searchParams.set("porudzbina", orderNumber);
    page.searchParams.set("iznos", String(amount));
    page.searchParams.set("potpis", await signPayment(orderNumber, "start"));
    return { ok: true, redirectUrl: page.toString() };
  },
  async confirm(request) {
    const params = new URL(request.url).searchParams;
    const orderNumber = params.get("porudzbina") ?? "";
    const outcome = params.get("ishod") ?? "";
    if (outcome !== "uspeh" && outcome !== "odbijeno") return null;
    if (!(await validSignature(orderNumber, outcome, params.get("potpis") ?? ""))) return null;
    return { orderNumber, paid: outcome === "uspeh", reference: `TEST-${orderNumber}` };
  },
  async refund() {
    return { ok: true };
  },
};

export const PAYMENT_PROVIDERS: PaymentProvider[] = [testProvider];

export function findProvider(id: string): PaymentProvider | undefined {
  return PAYMENT_PROVIDERS.find((provider) => provider.id === id);
}

/** Procesor koji prodavnica koristi, ako je kartica uključena i procesor povezan; inače null. */
export function cardProvider(settings: Settings): PaymentProvider | null {
  if (!settings.payment.card) return null;
  const provider = findProvider(settings.payment.cardProvider);
  return provider?.ready() ? provider : null;
}
