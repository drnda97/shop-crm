import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories } from "@/lib/content";
import { CollectionPage } from "@theme/pages/collection";

type Props = {
  params: Promise<{ kategorija: string }>;
  searchParams: Promise<{ pretraga?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kategorija } = await params;
  const category = (await getCategories()).find((candidate) => candidate.id === kategorija);
  if (!category) return {};
  const description = category.seoDescription || category.description.slice(0, 160);
  return {
    title: category.seoTitle || category.label,
    ...(description ? { description } : {}),
    alternates: { canonical: `/kolekcija/${category.id}` },
  };
}

/** Stranica kategorije: njeni proizvodi i proizvodi njenih podkategorija. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ kategorija }, { pretraga }] = await Promise.all([params, searchParams]);
  const category = (await getCategories()).find((candidate) => candidate.id === kategorija);
  if (!category) notFound();
  return <CollectionPage category={category} search={pretraga !== undefined} />;
}
