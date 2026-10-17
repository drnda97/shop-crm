import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getPost, toLocalInput, type Post } from "@/lib/blog";
import { getSettings } from "@/lib/content";
import { getPanelT } from "@/lib/i18n/server";
import { savePostAction } from "../../blog-actions";
import {
  buttonClass,
  Checkbox,
  fieldRowClass,
  fileClass,
  formGridClass,
  IMAGE_ACCEPT,
  IMAGE_HINT,
  inputClass,
  labelClass,
  PageHeader,
  panelClass,
  panelTitleClass,
  quietButtonClass,
  stackClass,
  textLinkClass,
  Thumb,
} from "../../ui";

type EditPostPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ greska?: string; ok?: string }>;
};

const hintClass = "font-sans text-[14px] font-normal text-muted";

/** Adresa za novi članak: ista forma kao za izmenu, a članak nastaje tek na „Sačuvaj". */
const NEW_POST = "novi";

export default async function EditPostPage({ params, searchParams }: EditPostPageProps) {
  const t = await getPanelT();
  const user = await requireAdmin("content");
  const [{ id }, { greska, ok }, settings] = await Promise.all([params, searchParams, getSettings()]);
  const isNew = id === NEW_POST;
  const post: Post | null = isNew
    ? {
        id: 0,
        slug: "",
        title: "",
        excerpt: "",
        body: "",
        image: "",
        imageAlt: "",
        author: user.name,
        tags: [],
        status: "draft",
        publishedAt: new Date().toISOString(),
        seoTitle: "",
        seoDescription: "",
        updatedAt: new Date().toISOString(),
      }
    : await getPost(Number(id));
  if (!post) notFound();
  const backPath = `${ADMIN_PATH}/blog`;

  return (
    <>
      <Link href={backPath} className={textLinkClass}>
        {t("← Blog")}
      </Link>
      <div className="mt-[12px]">
        <PageHeader
          title={isNew ? t("Novi članak") : post.title}
          error={greska}
          notice={ok}
          action={
            !isNew && (
              <Link href={`/blog/${post.slug}`} target="_blank" className={quietButtonClass}>
                {t("Otvori na sajtu")}
              </Link>
            )
          }
        />
      </div>

      <form action={savePostAction} className="flex flex-col gap-[16px]">
        <input type="hidden" name="id" value={isNew ? "" : post.id} />
        <div className={formGridClass}>
          <div className={stackClass}>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Članak")}</h2>
              <label className={labelClass}>
                {t("Naslov *")}
                <input name="title" required maxLength={255} defaultValue={post.title} className={inputClass} />
              </label>
              <label className={labelClass}>
                {t("Kratak opis (na spisku članaka)")}
                <textarea name="excerpt" maxLength={600} defaultValue={post.excerpt} className={`${inputClass} min-h-[90px]`} />
                <span className={hintClass}>{t("Prazno: uzima se početak teksta.")}</span>
              </label>
              <label className={labelClass}>
                {t("Tekst")}
                <textarea name="body" defaultValue={post.body} className={`${inputClass} min-h-[460px] font-mono text-[14px] leading-[1.6]`} />
                <span className={hintClass}>
                  {t("Prazan red razdvaja pasuse. ## Naslov, ### Podnaslov, - stavka spiska, 1. numerisana stavka, > citat. U tekstu: **podebljano**, *iskošeno*, [tekst linka](https://adresa). Slika u svom redu: ![opis](/media/slika.jpg) — adresu kopirate iz dela Slike.")}
                </span>
              </label>
            </section>
          </div>

          <div className={stackClass}>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Objava")}</h2>
              <div className={fieldRowClass}>
                <label className={labelClass}>
                  {t("Stanje")}
                  <select name="status" defaultValue={post.status} className={inputClass}>
                    <option value="draft">{t("Nacrt — kupac ga ne vidi")}</option>
                    <option value="published">{t("Objavljen")}</option>
                  </select>
                </label>
                <label className={labelClass}>
                  {t("Datum objave")}
                  <input
                    name="publishedAt"
                    type="datetime-local"
                    defaultValue={toLocalInput(post.publishedAt, settings.store.timeZone)}
                    className={inputClass}
                  />
                </label>
              </div>
              <span className={hintClass}>{t("Objavljen članak sa datumom u budućnosti postaje vidljiv tog dana.")}</span>
              <div className={fieldRowClass}>
                <label className={labelClass}>
                  {t("Autor")}
                  <input name="author" maxLength={100} defaultValue={post.author} className={inputClass} />
                </label>
                <label className={labelClass}>
                  {t("Oznake, odvojene zarezom")}
                  <input name="tags" defaultValue={post.tags.join(", ")} placeholder={t("Saveti, Novosti")} className={inputClass} />
                </label>
              </div>
            </section>

            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Naslovna fotografija")}</h2>
              {post.image && (
                <div className="flex flex-wrap items-center gap-[14px]">
                  <Thumb src={post.image} alt="" />
                  <label className="flex cursor-pointer items-center gap-[10px] text-[15px]">
                    <Checkbox name="imageRemove" />
                    {t("Ukloni fotografiju")}
                  </label>
                </div>
              )}
              <label className={labelClass}>
                {post.image ? t("Zameni fotografiju") : t("Fotografija")}
                <input name="image" type="file" accept={IMAGE_ACCEPT} className={fileClass} />
                <span className={hintClass}>{t(IMAGE_HINT)}</span>
              </label>
              <label className={labelClass}>
                {t("Opis fotografije (za čitače ekrana i pretraživače)")}
                <input name="imageAlt" maxLength={255} defaultValue={post.imageAlt} className={inputClass} />
              </label>
            </section>

            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Adresa i pretraživači")}</h2>
              <label className={labelClass}>
                {t("Adresa članka")}
                <input name="slug" required={!isNew} maxLength={150} defaultValue={post.slug} className={inputClass} />
                <span className={hintClass}>{isNew ? t("Prazno: pravi se iz naslova.") : `/blog/${post.slug}`}</span>
              </label>
              <label className={labelClass}>
                {t("Naslov za pretraživače")}
                <input name="seoTitle" maxLength={255} defaultValue={post.seoTitle} className={inputClass} />
              </label>
              <label className={labelClass}>
                {t("Opis za pretraživače")}
                <textarea name="seoDescription" maxLength={500} defaultValue={post.seoDescription} className={`${inputClass} min-h-[90px]`} />
              </label>
            </section>
          </div>
        </div>

        <div className="flex flex-wrap gap-[12px]">
          <button type="submit" className={buttonClass}>
            {t("Sačuvaj")}
          </button>
          <Link href={backPath} className={quietButtonClass}>
            {t("Odustani")}
          </Link>
        </div>
      </form>
    </>
  );
}
