import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getCategories } from "@/lib/content";
import { CollectionPage } from "@theme/pages/collection";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Kolekcija"), alternates: { canonical: "/kolekcija" } };
}

type Props = { searchParams: Promise<{ kategorija?: string; pretraga?: string }> };

/** Svi proizvodi. Stari linkovi sa ?kategorija=… vode na stranicu te kategorije. */
export default async function CollectionRoute({ searchParams }: Props) {
  const { kategorija, pretraga } = await searchParams;
  if (kategorija) {
    const wanted = kategorija.toLowerCase();
    const category = (await getCategories()).find(
      (candidate) => candidate.id === wanted || candidate.label.toLowerCase() === wanted,
    );
    if (category) permanentRedirect(`/kolekcija/${category.id}`);
  }
  return <CollectionPage search={pretraga !== undefined} />;
}
