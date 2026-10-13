import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findProvider, signPayment } from "@/lib/payments";
import { TestCardPage } from "@/themes/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Probno plaćanje"), robots: { index: false, follow: false } };
}

type Props = { searchParams: Promise<{ porudzbina?: string; iznos?: string; potpis?: string }> };

/**
 * Stranica probnog procesora kartica (lib/payments.ts): stoji umesto stranice banke dok pravi
 * procesor nije povezan. Postoji samo dok je uključen CARD_TEST_PROVIDER.
 */
export default async function TestCardRoute({ searchParams }: Props) {
  const { porudzbina = "", iznos = "", potpis = "" } = await searchParams;
  if (!findProvider("test")?.ready() || potpis !== (await signPayment(porudzbina, "start"))) notFound();
  const signatures = { uspeh: await signPayment(porudzbina, "uspeh"), odbijeno: await signPayment(porudzbina, "odbijeno") };
  const link = (outcome: "uspeh" | "odbijeno") =>
    `/api/v1/payments/test?porudzbina=${encodeURIComponent(porudzbina)}&ishod=${outcome}&potpis=${signatures[outcome]}`;

  return <TestCardPage orderNumber={porudzbina} amount={Number(iznos) || 0} payUrl={link("uspeh")} declineUrl={link("odbijeno")} />;
}
