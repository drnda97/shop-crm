import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/storefront/auth";
import { TrackingPage } from "@/themes/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Praćenje porudžbine"), robots: { index: false, follow: false } };
}

type Props = { searchParams: Promise<{ broj?: string }> };

/** Status porudžbine po broju i email adresi, bez naloga; odavde se podnosi i zahtev za povrat. */
export default async function TrackingRoute({ searchParams }: Props) {
  const [{ broj = "" }, user] = await Promise.all([searchParams, getCurrentUser()]);
  return <TrackingPage number={/^\d{1,10}$/.test(broj) ? broj : ""} loggedIn={user !== null} />;
}
