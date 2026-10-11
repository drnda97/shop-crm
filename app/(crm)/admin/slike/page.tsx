import { requireAdmin } from "@/lib/admin-auth";
import { getUsedImages, listUploads } from "@/lib/content";
import { hasSizes, sizedSrc } from "@/lib/media";
import { deleteImageAction, uploadImagesAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { buttonClass, cardClass, fileClass, IMAGE_ACCEPT, IMAGE_HINT, PageHeader } from "../ui";

type MediaPageProps = { searchParams: Promise<{ greska?: string }> };

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function MediaPage({ searchParams }: MediaPageProps) {
  await requireAdmin();
  const { greska } = await searchParams;
  const [files, used] = await Promise.all([listUploads(), getUsedImages()]);

  return (
    <>
      <PageHeader
        title="Slike"
        hint="Sve slike ubačene u panel. Iz ove biblioteke ih birate u sekcijama stranica. Slika koja se koristi na sajtu ne može da se obriše dok je ne zamenite tamo gde je prikazana."
        error={greska}
      />

      <form action={uploadImagesAction} className={`${cardClass} mb-[16px] flex flex-wrap items-center gap-[14px]`}>
        <input type="file" name="images" accept={IMAGE_ACCEPT} multiple required aria-label="Nove slike" className={fileClass} />
        <button type="submit" className={buttonClass}>
          Ubaci slike
        </button>
        <span className="text-[14px] text-muted">{IMAGE_HINT} po slici; više slika odjednom do 16 MB ukupno.</span>
      </form>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-[16px]">
        {files.map((file) => {
          const inUse = used.has(file.src);
          return (
            <div key={file.src} className="flex flex-col overflow-hidden rounded-[22px] bg-white shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sizedSrc(file.src, 320)} alt="" loading="lazy" className="aspect-[4/3] w-full bg-ph object-cover" />
              <div className="flex items-center justify-between gap-[8px] px-[14px] py-[10px]">
                <span className="text-[13.5px] text-muted">
                  {size(file.bytes)}
                  {hasSizes(file.src) && " · WebP"}
                  {inUse && " · na sajtu"}
                </span>
                {!inUse && (
                  <form action={deleteImageAction}>
                    <input type="hidden" name="src" value={file.src} />
                    <ConfirmButton
                      question="Obrisati ovu sliku? Ne može da se vrati."
                      className="cursor-pointer font-display text-[13.5px] font-bold underline decoration-line-strong hover:decoration-current"
                    >
                      Obriši
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {files.length === 0 && <p className="text-[15px] text-muted">Još nema ubačenih slika.</p>}
    </>
  );
}
