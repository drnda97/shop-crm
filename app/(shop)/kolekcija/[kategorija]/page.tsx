import { getShopPath } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListing, getShopCategories } from "@/lib/storefront/catalog";
import { CollectionPage } from "@/themes/pages";

type Props = {
  params: Promise<{ kategorija: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kategorija } = await params;
  const category = (await getShopCategories()).find((candidate) => candidate.id === kategorija);
  if (!category) return {};
  const description = category.seoDescription || category.description.slice(0, 160);
  return {
    title: category.seoTitle || category.label,
    ...(description ? { description } : {}),
    alternates: { canonical: (await getShopPath())(`/kolekcija/${category.id}`) },
  };
}

/** Stranica kategorije: njeni proizvodi i proizvodi njenih podkategorija. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ kategorija }, query] = await Promise.all([params, searchParams]);
  const category = (await getShopCategories()).find((candidate) => candidate.id === kategorija);
  if (!category) notFound();
  return <CollectionPage category={category} search={query.pretraga !== undefined} listing={await getListing(category.id, query)} />;
}
