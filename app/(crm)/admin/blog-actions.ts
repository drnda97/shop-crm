"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { createPost, deletePost, fromLocalInput, getAllPosts, getPost, parseTags, updatePost, type PostInput } from "@/lib/blog";
import { slugify } from "@/lib/catalog";
import { getSettings, removeUpload, saveUpload } from "@/lib/content";

/** Blog u panelu: dodavanje, izmena i brisanje članaka. */

const BLOG_PATH = `${ADMIN_PATH}/blog`;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function back(path: string, message: string): never {
  redirect(`${path}?greska=${encodeURIComponent(message)}`);
}

/** Adresa iz naslova koja nije zauzeta; po potrebi dobija nastavak -2, -3… */
function freeSlug(wanted: string, taken: string[]): string {
  const base = slugify(wanted).slice(0, 150);
  if (!base) return "";
  let slug = base;
  for (let n = 2; taken.includes(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/**
 * Čuva članak iz forme. Bez id-ja je to novi članak (forma na /blog/novi): nastaje tek sada,
 * sa svim upisanim, a adresa se pravi iz naslova ako nije upisana.
 */
export async function savePostAction(formData: FormData) {
  const user = await requireAdmin("content");
  const isNew = text(formData, "id") === "";
  const id = Number(text(formData, "id"));
  const existing = isNew ? null : await getPost(id);
  if (!isNew && !existing) redirect(BLOG_PATH);
  const formPath = `${BLOG_PATH}/${isNew ? "novi" : id}`;

  const title = text(formData, "title").slice(0, 255);
  if (!title) back(formPath, "Upišite naslov članka.");
  const slug = isNew
    ? freeSlug(text(formData, "slug") || title, (await getAllPosts()).map((post) => post.slug))
    : slugify(text(formData, "slug") || title).slice(0, 150);
  if (!slug) back(formPath, "Adresa članka mora imati bar jedno slovo ili cifru.");

  // Datum iz polja je u zoni prodavnice; prazan ili neispravan ostavlja dosadašnji (novi: sada).
  const { timeZone } = (await getSettings()).store;
  const publishedAt = fromLocalInput(text(formData, "publishedAt"), timeZone) ?? existing?.publishedAt ?? new Date().toISOString();

  let image = existing?.image ?? "";
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const upload = await saveUpload(file, `blog-${slug}`);
    if (!upload.ok) back(formPath, upload.error);
    image = upload.src;
  } else if (formData.get("imageRemove") === "on") {
    image = "";
  }

  const input: PostInput = {
    slug,
    title,
    excerpt: text(formData, "excerpt").slice(0, 600),
    body: String(formData.get("body") ?? "").slice(0, 200_000),
    image,
    imageAlt: text(formData, "imageAlt").slice(0, 255),
    author: (formData.has("author") ? text(formData, "author") : user.name).slice(0, 100),
    tags: parseTags(text(formData, "tags")),
    status: text(formData, "status") === "published" ? "published" : "draft",
    publishedAt,
    seoTitle: text(formData, "seoTitle").slice(0, 255),
    seoDescription: text(formData, "seoDescription").slice(0, 500),
  };
  if (isNew) {
    const created = await createPost(input);
    if (created === null) {
      await removeUpload(image);
      back(formPath, "Članak sa tom adresom već postoji.");
    }
    revalidatePath("/", "layout");
    await audit("Dodat članak na blogu", `${title}${input.status === "published" ? "" : " (nacrt)"}`);
    redirect(`${BLOG_PATH}/${created}?ok=${encodeURIComponent("Članak je sačuvan.")}`);
  }
  if (!(await updatePost(id, input))) back(formPath, "Drugi članak već ima tu adresu.");
  if (existing?.image && existing.image !== image) await removeUpload(existing.image);
  revalidatePath("/", "layout");
  await audit("Sačuvan članak na blogu", `${title}${input.status === "published" ? "" : " (nacrt)"}`);
  redirect(`${formPath}?ok=${encodeURIComponent("Članak je sačuvan.")}`);
}

export async function deletePostAction(formData: FormData) {
  await requireAdmin("content");
  const post = await getPost(Number(text(formData, "id")));
  if (post) {
    await deletePost(post.id);
    await removeUpload(post.image);
    revalidatePath("/", "layout");
    await audit("Obrisan članak sa bloga", post.title);
  }
  redirect(BLOG_PATH);
}
