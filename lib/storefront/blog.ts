import { cache } from "react";
import { isAdmin } from "@/lib/admin-auth";
import { getPostBySlug, getVisiblePosts, isVisible, type Post } from "@/lib/blog";
import { translateForShop } from "@/lib/i18n/server";
import { plainText } from "@/lib/rich-text";

/** Blog kako ga vidi kupac: samo objavljeni članci, na jeziku stranice. Samo za server. */

/** Članak na spisku: bez celog teksta. */
export type BlogCard = {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  author: string;
  tags: string[];
  publishedAt: string;
};

async function translated(post: Post): Promise<Post> {
  const { title, excerpt, body, imageAlt, tags, seoTitle, seoDescription } = post;
  return { ...post, ...(await translateForShop({ title, excerpt, body, imageAlt, tags, seoTitle, seoDescription })) };
}

function toCard(post: Post): BlogCard {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt || plainText(post.body, 180),
    image: post.image,
    imageAlt: post.imageAlt,
    author: post.author,
    tags: post.tags,
    publishedAt: post.publishedAt,
  };
}

export const getShopPosts = cache(async (): Promise<BlogCard[]> => {
  const posts = await Promise.all((await getVisiblePosts()).map(translated));
  return posts.map(toCard);
});

/** Ceo članak; nacrt i zakazan članak vidi samo korisnik prijavljen u panel. */
export const getShopPost = cache(async (slug: string): Promise<Post | null> => {
  const post = await getPostBySlug(slug);
  if (!post) return null;
  if (!isVisible(post) && !(await isAdmin())) return null;
  return translated(post);
});
