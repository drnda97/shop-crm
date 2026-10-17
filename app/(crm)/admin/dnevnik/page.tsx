import { getPanelT } from "@/lib/i18n/server";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getAuditLog } from "@/lib/audit";
import { getSettings } from "@/lib/content";
import { dateFormats } from "../order-ui";
import { cardClass, PageHeader, Pager, PANEL_PAGE_SIZE } from "../ui";

/** Dnevnik izmena: ko je i kada šta uradio u panelu. Samo za vlasnika. */
type AuditPageProps = { searchParams: Promise<{ strana?: string }> };

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const t = await getPanelT();
  await requireAdmin("users");
  const wanted = Math.max(1, Math.floor(Number((await searchParams).strana)) || 1);
  const [{ entries: first, total }, settings] = await Promise.all([getAuditLog(wanted, PANEL_PAGE_SIZE), getSettings()]);
  const pages = Math.max(1, Math.ceil(total / PANEL_PAGE_SIZE));
  const page = Math.min(wanted, pages);
  // Strana preko kraja (zapisi su u međuvremenu obrisani) prikazuje poslednju.
  const entries = page === wanted ? first : (await getAuditLog(page, PANEL_PAGE_SIZE)).entries;
  const { orderDate } = dateFormats(settings.store);

  return (
    <>
      <PageHeader
        title={t("Dnevnik")}
        hint={t("Izmene napravljene u panelu, najnovije prve. Čuva se šest meseci. Beleške i pomeranje redosleda se ne upisuju.")}
      />
      <div className={cardClass}>
        {entries.length === 0 ? (
          <p className="text-[15px] text-muted">{t("Još nema zapisa.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14.5px]">
              <thead>
                <tr className="font-display text-[13px] text-muted">
                  <th className="py-[6px] pr-[16px] font-semibold">{t("Kada")}</th>
                  <th className="py-[6px] pr-[16px] font-semibold">{t("Ko")}</th>
                  <th className="py-[6px] pr-[16px] font-semibold">{t("Šta")}</th>
                  <th className="py-[6px] font-semibold">{t("Na čemu")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index} className="border-t border-line align-top">
                    <td className="py-[8px] pr-[16px] whitespace-nowrap text-muted">{orderDate(entry.at)}</td>
                    <td className="py-[8px] pr-[16px] font-display font-bold whitespace-nowrap">{entry.userName}</td>
                    <td className="py-[8px] pr-[16px]">{t(entry.action)}</td>
                    <td className="py-[8px] text-muted">{t(entry.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {total > 0 && <Pager path={`${ADMIN_PATH}/dnevnik`} page={page} pages={pages} summary={t("Zapisa: {a}", { a: total })} />}
    </>
  );
}
