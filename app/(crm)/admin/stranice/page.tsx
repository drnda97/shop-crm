import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { pagePath } from "@/lib/catalog";
import { getPages } from "@/lib/content";
import { buttonClass, cardClass, PageHeader, quietButtonClass, rowClass } from "../ui";

type PagesPageProps = { searchParams: Promise<{ greska?: string }> };

export default async function PagesPage({ searchParams }: PagesPageProps) {
  const t = await getPanelT();
  await requireAdmin("content");
  const { greska } = await searchParams;
  const pages = await getPages();

  return (
    <>
      <PageHeader
        title={t("Stranice")}
        hint={t("Stranice sajta: početna, o nama, pitanja, kontakt, uslovi kupovine. Svaka je složena od sekcija koje dodajete, pomerate i menjate. Meni i podnožje su u delu Izgled sajta.")}
        error={greska}
        action={
          <Link href={`${ADMIN_PATH}/stranice/nova`} className={buttonClass}>
            {t("+ Nova stranica")}
          </Link>
        }
      />
      <div className={cardClass}>
        {pages.map((page) => (
          <div key={page.slug} className={rowClass}>
            <div className="min-w-[180px] grow">
              <div className="flex flex-wrap items-center gap-[10px] text-[17px]">
                {page.title}
                {!page.published && (
                  <span className="rounded-full bg-band px-[10px] py-[2px] font-display text-[12.5px] font-bold">
                    {t("nacrt")}
                  </span>
                )}
              </div>
              <div className="text-[14px] text-muted">
                {pagePath(page.slug)} {t("· sekcija:")} {page.sections.length}
              </div>
            </div>
            <Link href={`${ADMIN_PATH}/stranice/${page.slug}`} className={quietButtonClass}>
              {t("Izmeni")}
            </Link>
          </div>
        ))}
        {pages.length === 0 && <p className="text-[15px] text-muted">{t("Još nema stranica.")}</p>}
      </div>
    </>
  );
}
