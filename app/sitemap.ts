import type { MetadataRoute } from "next";
import { isAvailable, pagePath } from "@/lib/catalog";
import { getPages, getProducts } from "@/lib/content";
import { siteUrl } from "@/lib/storefront/pages";

// Sadržaj je u bazi, pa se spisak pravi pri svakom zahtevu.
export const dynamic = "force-dynamic";

/** Spisak adresa za pretraživače: objavljene stranice, kolekcija i proizvodi koji mogu da se poruče. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [base, pages, products] = await Promise.all([siteUrl(), getPages(), getProducts()]);
  return [
    ...pages.filter((page) => page.published).map((page) => `${base}${pagePath(page.slug)}`),
    `${base}/kolekcija`,
    ...products.filter(isAvailable).map((product) => `${base}/proizvod/${product.slug}`),
  ].map((url) => ({ url }));
}
