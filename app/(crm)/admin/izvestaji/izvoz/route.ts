import { isAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { csvResponse } from "@/lib/csv";
import { fromMinor } from "@/lib/format";
import { getOrders } from "@/lib/order-store";
import { buildReport, reportPeriod } from "@/lib/reports";

/** Izveštaj za izabrani period kao CSV: zbir, pa prodaja po danima i po proizvodima. */
export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Not found", { status: 404 });
  const query = new URL(request.url).searchParams;
  const [orders, settings] = await Promise.all([getOrders(), getSettings()]);
  const period = reportPeriod(query.get("od") ?? undefined, query.get("do") ?? undefined, settings.store.timeZone);
  const report = buildReport(orders, period, settings.store.timeZone);
  const amount = (value: number | null) => (value === null ? "" : fromMinor(value, settings.store.currencyDecimals).replace(".", ","));

  return csvResponse(`izvestaj-${period.from}-${period.to}.csv`, [
    ["Period", period.from, period.to],
    ["Prodaja", amount(report.sales)],
    ["Porudžbine", report.orders],
    ["Prosečna porudžbina", amount(report.average)],
    ["Prodato komada", report.pieces],
    ["Naplaćena dostava", amount(report.delivery)],
    ["Dati popusti", amount(report.discounts)],
    ["Vraćeno kupcima", amount(report.refunded)],
    ["Otkazano", report.cancelled],
    [],
    ["Dan", "Porudžbine", "Prodaja"],
    ...report.days.map((day) => [day.day, day.orders, amount(day.sales)]),
    [],
    ["Proizvod", "Komada", "Iznos"],
    ...report.products.map((row) => [row.label, row.qty, amount(row.amount)]),
  ]);
}
