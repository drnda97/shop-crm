import { getPanelT } from "@/lib/i18n/server";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { formatMoney } from "@/lib/format";
import { getOrders } from "@/lib/order-store";
import { buildReport, reportPeriod, type ReportRow } from "@/lib/reports";
import { currencyOf } from "@/lib/settings";
import { buttonClass, cardClass, inputClass, labelClass, PageHeader, panelTitleClass, quietButtonClass } from "../ui";

type ReportsPageProps = { searchParams: Promise<{ od?: string; do?: string }> };

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const t = await getPanelT();
  await requireAdmin("orders");
  const query = await searchParams;
  const [orders, settings] = await Promise.all([getOrders(), getSettings()]);
  const period = reportPeriod(query.od, query.do, settings.store.timeZone);
  const report = buildReport(orders, period, settings.store.timeZone);
  const currency = currencyOf(settings);
  const money = (value: number | null) => (value === null ? "—" : formatMoney(value, currency));
  const maxDay = Math.max(1, ...report.days.map((day) => day.sales));

  const table = (title: string, rows: ReportRow[], columns: [string, string, string]) => (
    <div className={cardClass}>
      <h2 className={`${panelTitleClass} mb-[8px]`}>{title}</h2>
      {rows.length === 0 ? (
        <p className="text-[15px] text-muted">{t("Nema podataka za ovaj period.")}</p>
      ) : (
        <table className="w-full text-left text-[14.5px]">
          <thead>
            <tr className="font-display text-[13px] text-muted">
              <th className="py-[6px] pr-[12px] font-semibold">{columns[0]}</th>
              <th className="py-[6px] pr-[12px] text-right font-semibold">{columns[1]}</th>
              <th className="py-[6px] text-right font-semibold">{columns[2]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((row) => (
              <tr key={row.label} className="border-t border-line">
                <td className="py-[7px] pr-[12px]">{row.label}</td>
                <td className="py-[7px] pr-[12px] text-right whitespace-nowrap">{columns[1] === "Komada" ? row.qty : row.orders}</td>
                <td className="py-[7px] text-right font-display font-bold whitespace-nowrap">{money(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title={t("Izveštaji")}
        hint={t("Prodaja je vrednost poručenih proizvoda posle popusta, bez dostave i bez vraćenog novca. Otkazane porudžbine se ne računaju.")}
        action={
          <a href={`${ADMIN_PATH}/izvestaji/izvoz?od=${period.from}&do=${period.to}`} className={quietButtonClass}>
            {t("Preuzmi CSV")}
          </a>
        }
      />

      <form action={`${ADMIN_PATH}/izvestaji`} className={`${cardClass} mb-[16px] flex flex-wrap items-end gap-[12px]`}>
        <label className={labelClass}>
          {t("Od")}
          <input type="date" name="od" defaultValue={period.from} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t("Do")}
          <input type="date" name="do" defaultValue={period.to} className={inputClass} />
        </label>
        <button type="submit" className={buttonClass}>
          {t("Prikaži")}
        </button>
      </form>

      <div className="mb-[16px] grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-[16px]">
        {[
          ["Prodaja", money(report.sales)],
          ["Porudžbine", String(report.orders)],
          ["Prosečna porudžbina", money(report.average)],
          ["Prodato komada", String(report.pieces)],
          ["Naplaćena dostava", money(report.delivery)],
          ["Dati popusti", money(report.discounts)],
          ["Vraćeno kupcima", money(report.refunded)],
          ["Otkazano", String(report.cancelled)],
        ].map(([label, value]) => (
          <div key={label} className={cardClass}>
            <div className="text-[13.5px] text-muted">{label}</div>
            <div className="mt-[4px] font-display text-[24px] font-bold tracking-[-0.02em]">{value}</div>
          </div>
        ))}
      </div>

      <div className={`${cardClass} mb-[16px]`}>
        <h2 className={`${panelTitleClass} mb-[10px]`}>{t("Po danima")}</h2>
        {report.days.length === 0 ? (
          <p className="text-[15px] text-muted">{t("Nema porudžbina u ovom periodu.")}</p>
        ) : (
          <table className="w-full text-left text-[14.5px]">
            <tbody>
              {report.days.map((day) => (
                <tr key={day.day} className="border-t border-line first:border-t-0">
                  <td className="w-[110px] py-[6px] pr-[12px] whitespace-nowrap">{day.day.split("-").reverse().join(". ")}.</td>
                  <td className="w-[70px] py-[6px] pr-[12px] text-right text-muted">{day.orders}</td>
                  <td className="py-[6px] pr-[12px]">
                    <div className="h-[10px] rounded-full bg-ink" style={{ width: `${Math.max(2, Math.round((day.sales / maxDay) * 100))}%` }} />
                  </td>
                  <td className="w-[130px] py-[6px] text-right font-display font-bold whitespace-nowrap">{money(day.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid items-start gap-[16px] xl:grid-cols-2">
        {table("Proizvodi", report.products, ["Proizvod", "Komada", "Iznos"])}
        <div className="flex flex-col gap-[16px]">
          {table("Načini plaćanja", report.payments, ["Način", "Porudžbina", "Naplaćeno"])}
          {table("Načini dostave", report.deliveries, ["Način", "Porudžbina", "Dostava"])}
          {table("Popusti", report.discountsUsed, ["Popust", "Porudžbina", "Dato"])}
        </div>
      </div>
    </>
  );
}
