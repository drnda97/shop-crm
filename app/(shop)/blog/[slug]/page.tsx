import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isVisible } from "@/lib/blog";
import { getShopPath } from "@/lib/i18n/server";
import { parseRichText, plainText } from "@/lib/rich-text";
import { getShopPost, getShopPosts } from "@/lib/storefront/blog";
import { getShopSettings, siteUrl } from "@/lib/storefront/pages";
import { ArticlePage } from "@/themes/pages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getShopPost(slug);
  if (!post) return {};
  const description = post.seoDescription || post.excerpt || plainText(post.body, 160);
  return {
    title: post.seoTitle || post.title,
    ...(description ? { description } : {}),
    alternates: { canonical: (await getShopPath())(`/blog/${post.slug}`) },
    openGraph: { type: "article", title: post.title, publishedTime: post.publishedAt, ...(post.image ? { images: [post.image] } : {}) },
    // Nacrt otvoren iz panela ne ide u pretraživače.
    ...(isVisible(post) ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function ArticleRoute({ params }: Props) {
  const { slug } = await params;
  const post = await getShopPost(slug);
  if (!post) notFound();
  const [posts, settings, base, to] = await Promise.all([getShopPosts(), getShopSettings(), siteUrl(), getShopPath()]);
  const date = new Intl.DateTimeFormat(settings.store.locale, { dateStyle: "long", timeZone: settings.store.timeZone });
  const structured = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: `${base}${to(`/blog/${post.slug}`)}`,
    ...(post.author ? { author: { "@type": "Person", name: post.author } } : {}),
    ...(post.image ? { image: [`${base}${post.image}`] } : {}),
    publisher: { "@type": "Organization", name: settings.store.name },
  };
  return (
    <ArticlePage
      post={{ title: post.title, image: post.image, imageAlt: post.imageAlt, author: post.author, tags: post.tags, date: date.format(new Date(post.publishedAt)) }}
      blocks={parseRichText(post.body)}
      more={posts
        .filter((candidate) => candidate.slug !== post.slug)
        .slice(0, 3)
        .map((candidate) => ({ ...candidate, date: date.format(new Date(candidate.publishedAt)) }))}
      structured={structured}
    />
  );
}
