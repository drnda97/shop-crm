import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { HOME_SLUG } from "@/lib/catalog";
import { getSitePage, inPreview } from "@/lib/storefront/pages";
import { ContentPage } from "@theme/pages/content";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getSitePage(slug);
  if (!page) return {};
  return {
    title: page.seoTitle || page.title,
    ...(page.seoDescription ? { description: page.seoDescription } : {}),
    alternates: { canonical: `/${page.slug}` },
    // Nacrt otvoren iz uređivača ne ide u pretraživače.
    ...(page.published ? {} : { robots: { index: false, follow: false } }),
  };
}

/** Stranica iz panela (Stranice) na adresi /{oznaka}: o nama, pitanja, kontakt, uslovi… */
export default async function SitePage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  // Početna ima samo jednu adresu.
  if (slug === HOME_SLUG && !(await inPreview())) permanentRedirect("/");
  const page = await getSitePage(slug);
  if (!page) notFound();
  return <ContentPage sections={page.sections} query={query} />;
}
