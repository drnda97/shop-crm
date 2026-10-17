import { getShopPath } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getListing, getShopCategories, getShopCollections } from "@/lib/storefront/catalog";
import { CollectionPage } from "@/themes/pages";

type Props = {
  params: Promise<{ kolekcija: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function findCollection(id: string) {
  return (await getShopCollections()).find((candidate) => candidate.id === id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kolekcija } = await params;
  const collection = await findCollection(kolekcija);
  if (!collection) return {};
  const description = collection.description.slice(0, 160);
  return {
    title: collection.name,
    ...(description ? { description } : {}),
    alternates: { canonical: (await getShopPath())(`/kolekcija/${collection.id}`) },
  };
}

/**
 * Stranica kolekcije: njeni proizvodi, sa istim filterima kao /kolekcija. Kategorije nemaju
 * svoje stranice, pa stari link /kolekcija/{kategorija} vodi na /kolekcija sa tim filterom.
 */
export default async function CollectionByIdPage({ params, searchParams }: Props) {
  const [{ kolekcija }, query] = await Promise.all([params, searchParams]);
  const collection = await findCollection(kolekcija);
  if (!collection) {
    if ((await getShopCategories()).some((category) => category.id === kolekcija)) {
      permanentRedirect((await getShopPath())(`/kolekcija?kategorija=${kolekcija}`));
    }
    notFound();
  }
  return <CollectionPage collection={collection} search={query.pretraga !== undefined} listing={await getListing(collection.id, query)} />;
}
