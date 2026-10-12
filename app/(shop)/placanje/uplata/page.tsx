import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { PaymentResultPage } from "@theme/pages/payment-result";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Plaćanje karticom"), robots: { index: false, follow: false } };
}

type Props = { searchParams: Promise<{ porudzbina?: string; ishod?: string }> };

/** Stranica na koju se kupac vraća posle plaćanja karticom. Podatke porudžbine ne prikazuje: adresa nije tajna. */
export default async function PaymentResultRoute({ searchParams }: Props) {
  const { porudzbina = "", ishod } = await searchParams;
  return <PaymentResultPage number={/^\d{1,10}$/.test(porudzbina) ? porudzbina : ""} paid={ishod === "uspeh"} />;
}
