import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_PATH, previewToken, requireAdmin } from "@/lib/admin-auth";
import { HOME_SLUG, pagePath } from "@/lib/catalog";
import { getCollections, getPages, getProducts, listUploads } from "@/lib/content";
import { PREVIEW_PARAM } from "@/lib/storefront/preview-names";
import { deletePageAction, renamePageAction } from "../../actions";
import { ConfirmButton } from "../../confirm-button";
import { cardClass, inputClass, labelClass, PageHeader, quietButtonClass, textLinkClass } from "../../ui";
import { PageEditor } from "./editor";

type AdminPagePageProps = { params: Promise<{ id: string }> };

export default async function AdminPagePage({ params }: AdminPagePageProps) {
  const t = await getPanelT();
  await requireAdmin("content");
  const { id } = await params;

  const [pages, collections, products, media] = await Promise.all([
    getPages(),
    getCollections(),
    getProducts(),
    listUploads(),
  ]);
  const page = pages.find((candidate) => candidate.slug === id);
  if (!page) notFound();
  const path = pagePath(page.slug);
  const isHome = page.slug === HOME_SLUG;

  return (
    <>
      <Link href={`${ADMIN_PATH}/stranice`} className={textLinkClass}>
        {t("← Stranice")}
      </Link>
      <div className="mt-[12px]">
        <PageHeader
          title={page.title}
          hint={
            <>
              {t("Adresa na sajtu:")} {path}
              {!page.published && t(" · nacrt, još se ne vidi na sajtu")}
            </>
          }
          action={
            page.published && (
              <a href={path} target="_blank" rel="noreferrer" className={quietButtonClass}>
                {t("Otvori na sajtu")}
              </a>
            )
          }
        />
      </div>

      <PageEditor
        // Posle čuvanja stranica stiže ponovo sa servera; uređivač zadržava svoje stanje.
        key={page.slug}
        page={page}
        isHome={isHome}
        // U pregledu je uvek sama stranica (i početna pod svojom oznakom), sa žetonom za nesačuvane izmene.
        previewUrl={`/${page.slug}?${PREVIEW_PARAM}=${await previewToken()}`}
        options={{
          collections: collections.map((item) => ({ value: item.id, label: item.name })),
          products: products.map((item) => ({ value: item.slug, label: item.name })),
          links: [
            ...pages.map((item) => ({ value: pagePath(item.slug), label: item.title })),
            { value: "/kolekcija", label: t("Kolekcija (svi proizvodi)") },
            ...collections.map((item) => ({ value: `/kolekcija/${item.id}`, label: `${t("Kolekcija")}: ${item.name}` })),
            { value: "/nalog", label: t("Nalog kupca") },
          ],
          media: media.map((file) => file.src),
        }}
      />

      {!isHome && (
        <form action={renamePageAction} className={`${cardClass} mt-[24px] flex flex-wrap items-end gap-[12px]`}>
          <input type="hidden" name="slug" value={page.slug} />
          <label className={`${labelClass} min-w-[240px] grow basis-0`}>
            {t("Adresa stranice na sajtu")}
            <input name="newSlug" required maxLength={80} defaultValue={page.slug} className={inputClass} />
            <span className="text-[13.5px] font-normal text-muted">
              {t("Mala slova bez kvačica, cifre i crtice. Linkovi ka stranici u meniju, podnožju i sekcijama se ispravljaju sami; linkovi sa drugih sajtova na staru adresu prestaju da rade.")}
            </span>
          </label>
          <button type="submit" className={quietButtonClass}>
            {t("Promeni adresu")}
          </button>
        </form>
      )}

      {!isHome && (
        <form action={deletePageAction} className="mt-[24px]">
          <input type="hidden" name="slug" value={page.slug} />
          <ConfirmButton question={t("Obrisati stranicu „{a}”?", { a: page.title })} className={quietButtonClass}>
            {t("Obriši stranicu")}
          </ConfirmButton>
        </form>
      )}
    </>
  );
}
