import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getPages } from "@/lib/content";
import { buttonClass, cardClass, PageHeader, quietButtonClass, rowClass } from "../ui";

type PagesPageProps = { searchParams: Promise<{ greska?: string }> };

export default async function PagesPage({ searchParams }: PagesPageProps) {
  await requireAdmin();
  const { greska } = await searchParams;
  const pages = await getPages();

  return (
    <>
      <PageHeader
        title="Stranice"
        hint="Tekstovi i fotografije koje sajt čita preko API-ja: uslovi kupovine, o nama, ali i delovi početne strane (npr. stranica „Početna — baner“ čije fotografije sajt prikazuje na vrhu)."
        error={greska}
        action={
          <Link href={`${ADMIN_PATH}/stranice/nova`} className={buttonClass}>
            + Nova stranica
          </Link>
        }
      />
      <div className={cardClass}>
        {pages.map((page) => (
          <div key={page.slug} className={rowClass}>
            <div className="min-w-[180px] grow">
              <div className="text-[17px]">{page.title}</div>
              <div className="text-[14px] text-muted">
                oznaka za API: {page.slug} · fotografija: {page.images.length}
                {page.showInFooter && " · u podnožju"}
              </div>
            </div>
            <Link href={`${ADMIN_PATH}/stranice/${page.slug}`} className={quietButtonClass}>
              Izmeni
            </Link>
          </div>
        ))}
        {pages.length === 0 && <p className="text-[15px] text-muted">Još nema stranica.</p>}
      </div>
    </>
  );
}
