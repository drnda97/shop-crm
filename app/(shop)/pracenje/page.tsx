import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/storefront/auth";
import { OrderLookup } from "../_components/account-extras";
import { SimplePage } from "../_components/simple-page";

export const metadata: Metadata = { title: "Praćenje porudžbine", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ broj?: string }> };

/** Status porudžbine po broju i email adresi, bez naloga; odavde se podnosi i zahtev za povrat. */
export default async function TrackingPage({ searchParams }: Props) {
  const [{ broj = "" }, user] = await Promise.all([searchParams, getCurrentUser()]);
  return (
    <SimplePage title="Praćenje porudžbine">
      <p className="lead">Upišite broj porudžbine iz emaila i adresu sa kojom ste poručili.</p>
      <OrderLookup number={/^\d{1,10}$/.test(broj) ? broj : ""} loggedIn={user !== null} />
    </SimplePage>
  );
}
