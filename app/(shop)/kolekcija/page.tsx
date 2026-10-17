import { getShopPath, getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getListing, getShopCategories } from "@/lib/storefront/catalog";
import { CollectionPage } from "@/themes/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Kolekcija"), alternates: { canonical: (await getShopPath())("/kolekcija") } };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Svi proizvodi; kategorija je filter (?kategorija=id). Stari linkovi sa nazivom kategorije (?kategorija=Fotelje) dobijaju njen id. */
export default async function CollectionRoute({ searchParams }: Props) {
  const params = await searchParams;
  const { kategorija, pretraga } = params;
  if (typeof kategorija === "string" && kategorija) {
    const wanted = kategorija.toLowerCase();
    const categories = await getShopCategories();
    const category = categories.some((candidate) => candidate.id === kategorija)
      ? undefined
      : categories.find((candidate) => candidate.label.toLowerCase() === wanted);
    if (category) {
      const rest = new URLSearchParams(Object.entries(params).flatMap(([name, value]) => [value ?? []].flat().map((item) => [name, item])));
      rest.set("kategorija", category.id);
      permanentRedirect((await getShopPath())(`/kolekcija?${rest}`));
    }
  }
  return <CollectionPage search={pretraga !== undefined} listing={await getListing("", params)} />;
}
