import type { Metadata } from "next";
import { POSTS_PER_PAGE } from "@/lib/blog";
import { getShopPath, getShopT } from "@/lib/i18n/server";
import { getShopPosts } from "@/lib/storefront/blog";
import { getShopSettings } from "@/lib/storefront/pages";
import { BlogPage } from "@/themes/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Blog"), alternates: { canonical: (await getShopPath())("/blog") } };
}

type Props = { searchParams: Promise<{ oznaka?: string; strana?: string }> };

/** Spisak članaka, najnoviji prvi; ?oznaka= bira članke sa tom oznakom, ?strana= stranu. */
export default async function BlogRoute({ searchParams }: Props) {
  const [{ oznaka, strana }, all, settings] = await Promise.all([searchParams, getShopPosts(), getShopSettings()]);
  const tags = [...new Set(all.flatMap((post) => post.tags))];
  const tag = tags.find((candidate) => candidate.toLowerCase() === (oznaka ?? "").toLowerCase()) ?? "";
  const matching = tag ? all.filter((post) => post.tags.includes(tag)) : all;
  const pages = Math.max(1, Math.ceil(matching.length / POSTS_PER_PAGE));
  const page = Math.min(Math.max(Math.trunc(Number(strana)) || 1, 1), pages);
  const date = new Intl.DateTimeFormat(settings.store.locale, { dateStyle: "long", timeZone: settings.store.timeZone });
  return (
    <BlogPage
      posts={matching.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE).map((post) => ({ ...post, date: date.format(new Date(post.publishedAt)) }))}
      tags={tags}
      tag={tag}
      page={page}
      pages={pages}
    />
  );
}
