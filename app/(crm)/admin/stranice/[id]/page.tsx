import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getPages } from "@/lib/content";
import { deletePageAction, deletePageImageAction, savePageImageAction } from "../../actions";
import { ConfirmButton } from "../../confirm-button";
import {
  buttonClass,
  cardClass,
  fileClass,
  formGridClass,
  IMAGE_ACCEPT,
  IMAGE_HINT,
  inputClass,
  labelClass,
  PageHeader,
  panelTitleClass,
  quietButtonClass,
  rowClass,
  textLinkClass,
  Thumb,
} from "../../ui";
import { PageForm } from "../page-form";

type AdminPagePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ greska?: string }>;
};

export default async function AdminPagePage({ params, searchParams }: AdminPagePageProps) {
  await requireAdmin();
  const [{ id }, { greska }] = await Promise.all([params, searchParams]);

  const page = (await getPages()).find((candidate) => candidate.slug === id);
  if (!page) notFound();

  return (
    <>
      <Link href={`${ADMIN_PATH}/stranice`} className={textLinkClass}>
        ← Stranice
      </Link>
      <div className="mt-[12px]">
        <PageHeader title={page.title} hint={`Oznaka za API: ${page.slug}`} error={greska} />
      </div>

      <div className={formGridClass}>
        <PageForm page={page} />
        <div className={`${cardClass} min-w-0`}>
          <h2 className={`${panelTitleClass} mb-[4px]`}>Fotografije</h2>
          <p className="mb-[8px] text-[14px] text-muted">
            API ih vraća redom kojim su dodate. {IMAGE_HINT}.
          </p>
          {page.images.map((image) => (
            <div key={image.id} className={rowClass}>
              <Thumb src={image.src} alt={image.alt} />
              <form
                action={savePageImageAction}
                className="flex grow flex-wrap items-center gap-[12px]"
              >
                <input type="hidden" name="slug" value={page.slug} />
                <input type="hidden" name="imageId" value={image.id} />
                <div className="min-w-[120px] grow text-[15px]">{image.alt || "bez opisa"}</div>
                <input
                  type="file"
                  name="image"
                  accept={IMAGE_ACCEPT}
                  required
                  aria-label={`Nova slika: ${image.alt || page.title}`}
                  className={fileClass}
                />
                <button type="submit" className={quietButtonClass}>
                  Zameni
                </button>
              </form>
              <form action={deletePageImageAction}>
                <input type="hidden" name="slug" value={page.slug} />
                <input type="hidden" name="imageId" value={image.id} />
                <ConfirmButton
                  question="Ukloniti ovu fotografiju sa stranice?"
                  className={quietButtonClass}
                >
                  Ukloni
                </ConfirmButton>
              </form>
            </div>
          ))}
          {page.images.length === 0 && (
            <p className="py-[8px] text-[15px] text-muted">Stranica još nema fotografija.</p>
          )}

          <form
            action={savePageImageAction}
            className="mt-[8px] flex flex-wrap items-end gap-[12px] border-t border-line pt-[16px]"
          >
            <input type="hidden" name="slug" value={page.slug} />
            <label className={`${labelClass} min-w-[200px] grow`}>
              Opis nove fotografije (šta je na njoj)
              <input name="alt" className={inputClass} />
            </label>
            <input
              type="file"
              name="image"
              accept={IMAGE_ACCEPT}
              required
              aria-label="Nova fotografija"
              className={`${fileClass} min-h-[44px]`}
            />
            <button type="submit" className={buttonClass}>
              Dodaj fotografiju
            </button>
          </form>
        </div>
      </div>

      <form action={deletePageAction} className="mt-[24px]">
        <input type="hidden" name="slug" value={page.slug} />
        <ConfirmButton
          question={`Obrisati stranicu „${page.title}" i njene fotografije?`}
          className={quietButtonClass}
        >
          Obriši stranicu
        </ConfirmButton>
      </form>
    </>
  );
}
