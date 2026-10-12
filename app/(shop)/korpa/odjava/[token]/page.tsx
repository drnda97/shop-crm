import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { CartUnsubscribePage } from "@theme/pages/simple";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Odjava od podsetnika"), robots: { index: false, follow: false } };
}

/** Link „Ne želim podsetnike" iz emaila o napuštenoj korpi. */
export default async function CartUnsubscribeRoute({ params }: { params: Promise<{ token: string }> }) {
  return <CartUnsubscribePage token={(await params).token} />;
}
