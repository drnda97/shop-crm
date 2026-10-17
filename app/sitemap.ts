import { localPath } from "@/lib/routes";
import type { MetadataRoute } from "next";
import { isAvailable, pagePath } from "@/lib/catalog";
import { getCollections, getPages, getProducts, getSettings } from "@/lib/content";
import { getVisiblePosts } from "@/lib/blog";
import { siteUrl } from "@/lib/storefront/pages";

// Sadržaj je u bazi, pa se spisak pravi pri svakom zahtevu.
export const dynamic = "force-dynamic";

/** Spisak adresa za pretraživače: objavljene stranice, sve kolekcije i proizvodi koji mogu da se poruče. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, base, pages, products, collections, posts] = await Promise.all([
    getSettings(),
    siteUrl(),
    getPages(),
    getProducts(),
    getCollections(),
    getVisiblePosts(),
  ]);
  const to = (path: string) => localPath(settings.store.language, path);
  return [
    ...pages.filter((page) => page.published).map((page) => `${base}${pagePath(page.slug)}`),
    `${base}${to("/kolekcija")}`,
    ...collections.map((collection) => `${base}${to(`/kolekcija/${collection.id}`)}`),
    ...products.filter(isAvailable).map((product) => `${base}${to(`/proizvod/${product.slug}`)}`),
    ...(posts.length > 0 ? [`${base}${to("/blog")}`] : []),
    ...posts.map((post) => `${base}${to(`/blog/${post.slug}`)}`),
  ].map((url) => ({ url }));
}
