import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { getCartByToken } from "@/lib/abandoned";
import { RestoreCartPage } from "@theme/pages/simple";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Vaša korpa"), robots: { index: false, follow: false } };
}

/** Link iz podsetnika za napuštenu korpu: vraća sačuvane proizvode u korpu i vodi na plaćanje. */
export default async function RestoreCartRoute({ params }: { params: Promise<{ token: string }> }) {
  const cart = await getCartByToken((await params).token);
  return <RestoreCartPage items={(cart?.items ?? []).map((item) => ({ slug: item.slug, qty: item.qty, variantId: item.variant }))} />;
}
