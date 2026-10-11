import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HOME_SLUG } from "@/lib/catalog";
import { getShopSettings, getSitePage } from "@/lib/storefront/pages";
import { PageView } from "./_sections/page-view";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getSitePage(HOME_SLUG), getShopSettings()]);
  return {
    title: { absolute: page?.seoTitle || settings.store.name },
    ...(page?.seoDescription ? { description: page.seoDescription } : {}),
    alternates: { canonical: "/" },
  };
}

/** Početna strana: stranica „Početna" iz panela (Stranice). */
export default async function HomePage({ searchParams }: Props) {
  const query = await searchParams;
  const page = await getSitePage(HOME_SLUG);
  if (!page) notFound();
  return <PageView sections={page.sections} query={query} />;
}
