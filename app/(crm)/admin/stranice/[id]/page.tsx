import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_PATH, previewToken, requireAdmin } from "@/lib/admin-auth";
import { HOME_SLUG, pagePath } from "@/lib/catalog";
import { getCollections, getPages, getProducts, listUploads } from "@/lib/content";
import { PREVIEW_PARAM } from "@/lib/storefront/preview-names";
import { deletePageAction } from "../../actions";
import { ConfirmButton } from "../../confirm-button";
import { PageHeader, quietButtonClass, textLinkClass } from "../../ui";
import { PageEditor } from "./editor";

type AdminPagePageProps = { params: Promise<{ id: string }> };

export default async function AdminPagePage({ params }: AdminPagePageProps) {
  await requireAdmin();
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
        ← Stranice
      </Link>
      <div className="mt-[12px]">
        <PageHeader
          title={page.title}
          hint={
            <>
              Adresa na sajtu: {path}
              {!page.published && " · nacrt, još se ne vidi na sajtu"}
            </>
          }
          action={
            page.published && (
              <a href={path} target="_blank" rel="noreferrer" className={quietButtonClass}>
                Otvori na sajtu
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
        previewUrl={`/${page.slug}?${PREVIEW_PARAM}=${previewToken()}`}
        options={{
          collections: collections.map((item) => ({ value: item.id, label: item.name })),
          products: products.map((item) => ({ value: item.slug, label: item.name })),
          links: [
            ...pages.map((item) => ({ value: pagePath(item.slug), label: item.title })),
            { value: "/kolekcija", label: "Kolekcija (svi proizvodi)" },
            { value: "/nalog", label: "Nalog kupca" },
          ],
          media: media.map((file) => file.src),
        }}
      />

      {!isHome && (
        <form action={deletePageAction} className="mt-[24px]">
          <input type="hidden" name="slug" value={page.slug} />
          <ConfirmButton question={`Obrisati stranicu „${page.title}”?`} className={quietButtonClass}>
            Obriši stranicu
          </ConfirmButton>
        </form>
      )}
    </>
  );
}
