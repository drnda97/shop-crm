import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";
import { richTextImages } from "@/lib/rich-text";

/**
 * Blog: članci koje prodavnica objavljuje na /blog. Članak ima naslov, kratak opis, tekst
 * (lib/rich-text.ts), naslovnu fotografiju, autora, oznake i datum objave; nacrt i članak sa
 * datumom u budućnosti kupac ne vidi. Samo za server.
 */

export type PostStatus = "draft" | "published";

export type Post = {
  id: number;
  slug: string;
  title: string;
  /** Kratak opis za spisak članaka; prazno: uzima se početak teksta. */
  excerpt: string;
  body: string;
  image: string;
  imageAlt: string;
  author: string;
  tags: string[];
  status: PostStatus;
  /** Kada članak postaje vidljiv (ISO); datum u budućnosti zakazuje objavu. */
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
};

export type PostInput = Omit<Post, "id" | "updatedAt">;

export const POSTS_PER_PAGE = 9;

function toPost(row: RowDataPacket): Post {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    image: row.image ?? "",
    imageAlt: row.image_alt,
    author: row.author,
    tags: parseTags(row.tags),
    status: row.status === "published" ? "published" : "draft",
    publishedAt: (row.published_at as Date).toISOString(),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/** „Saveti, Nega nameštaja" → ["Saveti", "Nega nameštaja"]; bez praznih i ponovljenih, najviše 12. */
export function parseTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value.split(",")) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  return tags.slice(0, 12);
}

/** Trenutak (ISO) kao vrednost polja datetime-local u vremenskoj zoni prodavnice: „2026-10-13T09:30". */
export function toLocalInput(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(iso)).replace(" ", "T");
}

/** Obrnuto: vrednost polja, upisana u zoni prodavnice, kao trenutak; null kada nije datum. */
export function fromLocalInput(value: string, timeZone: string): string | null {
  const asUtc = new Date(`${value}Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  const shown = new Date(`${toLocalInput(asUtc.toISOString(), timeZone)}Z`);
  return new Date(asUtc.getTime() - (shown.getTime() - asUtc.getTime())).toISOString();
}

/** Kupac vidi objavljen članak čiji je datum objave stigao. */
export function isVisible(post: Pick<Post, "status" | "publishedAt">, now = new Date()): boolean {
  return post.status === "published" && new Date(post.publishedAt).getTime() <= now.getTime();
}

/** Svi članci za panel, najnoviji prvi. */
export async function getAllPosts(): Promise<Post[]> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT * FROM blog_posts ORDER BY published_at DESC, id DESC");
  return rows.map(toPost);
}

/** Članci koje kupac vidi, najnoviji prvi. */
export async function getVisiblePosts(): Promise<Post[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT * FROM blog_posts WHERE status = 'published' AND published_at <= ? ORDER BY published_at DESC, id DESC", [new Date()]);
  return rows.map(toPost);
}

export async function getPost(id: number): Promise<Post | null> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT * FROM blog_posts WHERE id = ?", [id]);
  return rows.length > 0 ? toPost(rows[0]) : null;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT * FROM blog_posts WHERE slug = ?", [slug]);
  return rows.length > 0 ? toPost(rows[0]) : null;
}

function values(input: PostInput) {
  return [
    input.slug,
    input.title,
    input.excerpt,
    input.body,
    input.image || null,
    input.imageAlt,
    input.author,
    input.tags.join(", "),
    input.status,
    new Date(input.publishedAt),
    input.seoTitle,
    input.seoDescription,
    new Date(),
  ];
}

/** Dodaje članak; null kada je adresa zauzeta. */
export async function createPost(input: PostInput): Promise<number | null> {
  try {
    const [result] = await (
      await getDb()
    ).query<ResultSetHeader>(
      `INSERT INTO blog_posts (slug, title, excerpt, body, image, image_alt, author, tags, status, published_at, seo_title, seo_description, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values(input),
    );
    return result.insertId;
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return null;
    throw error;
  }
}

/** Čuva izmene; false kada je nova adresa zauzeta. */
export async function updatePost(id: number, input: PostInput): Promise<boolean> {
  try {
    await (
      await getDb()
    ).query(
      `UPDATE blog_posts SET slug = ?, title = ?, excerpt = ?, body = ?, image = ?, image_alt = ?, author = ?, tags = ?, status = ?,
       published_at = ?, seo_title = ?, seo_description = ?, updated_at = ? WHERE id = ?`,
      [...values(input), id],
    );
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return false;
    throw error;
  }
}

export async function deletePost(id: number) {
  await (await getDb()).query("DELETE FROM blog_posts WHERE id = ?", [id]);
}

/** Slike koje članci koriste: naslovne i one u tekstu. Takva slika se ne briše iz biblioteke. */
export async function getBlogImages(): Promise<Set<string>> {
  return new Set((await getBlogImageUses()).keys());
}

/** Slike iz članaka, sa naslovima članaka u kojima su. */
export async function getBlogImageUses(): Promise<Map<string, string[]>> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT title, image, body FROM blog_posts");
  const uses = new Map<string, string[]>();
  for (const row of rows) {
    for (const src of new Set([row.image, ...richTextImages(row.body)].filter(Boolean))) {
      uses.set(src, [...(uses.get(src) ?? []), row.title]);
    }
  }
  return uses;
}

/** Sve oznake vidljivih članaka, po broju članaka. */
export function tagList(posts: Post[]): string[] {
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
}
