import { cookies } from "next/headers";
import { getPanelT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getImageUses, listUploads } from "@/lib/content";
import { hasSizes } from "@/lib/media";
import { uploadImagesAction } from "../actions";
import { buttonClass, cardClass, fileClass, IMAGE_ACCEPT, IMAGE_HINT, PageHeader } from "../ui";
import { MediaLibrary } from "./media-library";
import { MEDIA_VIEW_COOKIE } from "./view-cookie";

type MediaPageProps = { searchParams: Promise<{ greska?: string }> };

export default async function MediaPage({ searchParams }: MediaPageProps) {
  const t = await getPanelT();
  await requireAdmin("content");
  const { greska } = await searchParams;
  const [files, uses, jar] = await Promise.all([listUploads(), getImageUses(), cookies()]);

  return (
    <>
      <PageHeader
        title={t("Slike")}
        hint={t("Sve slike ubačene u panel. Iz ove biblioteke ih birate u sekcijama stranica. Slika koja se koristi na sajtu ne može da se obriše dok je ne zamenite tamo gde je prikazana.")}
        error={greska}
      />

      <form action={uploadImagesAction} className={`${cardClass} mb-[16px] flex flex-wrap items-center gap-[14px]`}>
        <input type="file" name="images" accept={IMAGE_ACCEPT} multiple required aria-label={t("Nove slike")} className={fileClass} />
        <button type="submit" className={buttonClass}>
          {t("Ubaci slike")}
        </button>
        <span className="text-[14px] text-muted">{t(IMAGE_HINT)} {t("po slici; više slika odjednom do 16 MB ukupno.")}</span>
      </form>

      <MediaLibrary
        view={jar.get(MEDIA_VIEW_COOKIE)?.value ?? ""}
        images={files.map((file) => ({ ...file, hasSizes: hasSizes(file.src), uses: uses.get(file.src) ?? [] }))}
      />
    </>
  );
}
