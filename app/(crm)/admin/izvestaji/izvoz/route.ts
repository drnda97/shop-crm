import { getPanelT } from "@/lib/i18n/server";
import { hasAccess } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { csvResponse } from "@/lib/csv";
import { fromMinor } from "@/lib/format";
import { getOrders } from "@/lib/order-store";
import { buildReport, reportPeriod } from "@/lib/reports";

/** Izveštaj za izabrani period kao CSV: zbir, pa prodaja po danima i po proizvodima. */
export async function GET(request: Request) {
  const t = await getPanelT();
  if (!(await hasAccess("orders"))) return new Response("Not found", { status: 404 });
  const query = new URL(request.url).searchParams;
  const [orders, settings] = await Promise.all([getOrders(), getSettings()]);
  const period = reportPeriod(query.get("od") ?? undefined, query.get("do") ?? undefined, settings.store.timeZone);
  const report = buildReport(orders, period, settings.store.timeZone);
  const amount = (value: number | null) => (value === null ? "" : fromMinor(value, settings.store.currencyDecimals).replace(".", ","));

  return csvResponse(`izvestaj-${period.from}-${period.to}.csv`, [
    [t("Period"), period.from, period.to],
    [t("Prodaja"), amount(report.sales)],
    [t("Porudžbine"), report.orders],
    [t("Prosečna porudžbina"), amount(report.average)],
    [t("Prodato komada"), report.pieces],
    [t("Naplaćena dostava"), amount(report.delivery)],
    [t("Dati popusti"), amount(report.discounts)],
    [t("Vraćeno kupcima"), amount(report.refunded)],
    [t("Otkazano"), report.cancelled],
    [],
    ["Dan", t("Porudžbine"), t("Prodaja")],
    ...report.days.map((day) => [day.day, day.orders, amount(day.sales)]),
    [],
    [t("Proizvod"), t("Komada"), t("Iznos")],
    ...report.products.map((row) => [row.label, row.qty, amount(row.amount)]),
  ]);
}
