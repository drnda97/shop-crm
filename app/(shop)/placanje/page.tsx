import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { getAddress, getCurrentUser } from "@/lib/storefront/auth";
import { getShopSettings } from "@/lib/storefront/pages";
import { CheckoutPage } from "@theme/pages/checkout";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Plaćanje"), robots: { index: false, follow: false } };
}

export default async function CheckoutRoute() {
  const [user, settings] = await Promise.all([getCurrentUser(), getShopSettings()]);
  // Adresa sačuvana uz nalog popunjava formu.
  const address = user ? await getAddress(user.id) : null;
  return (
    <CheckoutPage
      storeName={settings.store.name}
      user={user ? { email: user.email, firstName: user.firstName, lastName: user.lastName, ...address } : null}
    />
  );
}
