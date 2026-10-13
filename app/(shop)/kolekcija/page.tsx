import { getShopPath, getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getListing, getShopCategories } from "@/lib/storefront/catalog";
import { CollectionPage } from "@/themes/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Kolekcija"), alternates: { canonical: (await getShopPath())("/kolekcija") } };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Svi proizvodi. Stari linkovi sa ?kategorija=… vode na stranicu te kategorije. */
export default async function CollectionRoute({ searchParams }: Props) {
  const params = await searchParams;
  const { kategorija, pretraga } = params;
  if (typeof kategorija === "string" && kategorija) {
    const wanted = kategorija.toLowerCase();
    const category = (await getShopCategories()).find(
      (candidate) => candidate.id === wanted || candidate.label.toLowerCase() === wanted,
    );
    if (category) permanentRedirect((await getShopPath())(`/kolekcija/${category.id}`));
  }
  return <CollectionPage search={pretraga !== undefined} listing={await getListing("", params)} />;
}
