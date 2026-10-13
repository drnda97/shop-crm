import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { WishlistPage } from "@/themes/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Lista želja"), robots: { index: false, follow: false } };
}

export default function WishlistRoute() {
  return <WishlistPage />;
}
