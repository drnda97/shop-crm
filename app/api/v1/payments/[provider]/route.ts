import { localPath } from "@/lib/routes";
import { getOrder, setOrderPaid, addOrderEvent } from "@/lib/order-store";
import { getSettings } from "@/lib/content";
import { getDb } from "@/lib/db";
import { findProvider } from "@/lib/payments";
import { siteUrl } from "@/lib/storefront/pages";

/**
 * Potvrda plaćanja karticom: ovde procesor vraća kupca posle plaćanja, ili sam javlja ishod.
 * Potpis potvrde proverava procesor (lib/payments.ts); bez ispravnog potpisa se ništa ne menja.
 */

type Context = { params: Promise<{ provider: string }> };

async function handle(request: Request, { params }: Context) {
  const provider = findProvider((await params).provider);
  const confirmation = provider?.ready() ? await provider.confirm(request) : null;
  if (!provider || !confirmation) return new Response("Bad request", { status: 400 });

  const order = await getOrder(confirmation.orderNumber);
  if (!order || order.paymentMethod !== "card") return new Response("Not found", { status: 404 });

  if (confirmation.paid) {
    await setOrderPaid(order.number, true, `Plaćeno karticom (${provider.label}, ${confirmation.reference})`, confirmation.reference);
  } else if (!order.paidAt) {
    await addOrderEvent(await getDb(), order.number, `Plaćanje karticom nije uspelo (${provider.label})`);
  }

  // Kupac se vraća na stranicu ishoda, na adresi na jeziku sajta.
  const outcome = confirmation.paid || order.paidAt ? "uspeh" : "odbijeno";
  const lang = (await getSettings()).store.language;
  const result = new URL(localPath(lang, `/placanje/uplata?porudzbina=${order.number}&ishod=${outcome}`), await siteUrl());
  return Response.redirect(result, 303);
}

export const GET = handle;
export const POST = handle;
