import { localPath } from "@/lib/routes";
import type { MetadataRoute } from "next";
import { isAvailable, pagePath } from "@/lib/catalog";
import { getCategories, getPages, getProducts, getSettings } from "@/lib/content";
import { siteUrl } from "@/lib/storefront/pages";

// Sadržaj je u bazi, pa se spisak pravi pri svakom zahtevu.
export const dynamic = "force-dynamic";

/** Spisak adresa za pretraživače: objavljene stranice, kolekcija i proizvodi koji mogu da se poruče. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, base, pages, products, categories] = await Promise.all([
    getSettings(),
    siteUrl(),
    getPages(),
    getProducts(),
    getCategories(),
  ]);
  const to = (path: string) => localPath(settings.store.language, path);
  return [
    ...pages.filter((page) => page.published).map((page) => `${base}${pagePath(page.slug)}`),
    `${base}${to("/kolekcija")}`,
    ...categories.map((category) => `${base}${to(`/kolekcija/${category.id}`)}`),
    ...products.filter(isAvailable).map((product) => `${base}${to(`/proizvod/${product.slug}`)}`),
  ].map((url) => ({ url }));
}
