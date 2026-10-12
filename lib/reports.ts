import { discountText } from "@/lib/discounts";
import { itemName, type Order } from "@/lib/orders";
import { paymentLabels } from "@/lib/settings";

/**
 * Izveštaj o prodaji za izabrani period. Računa se iz porudžbina; otkazane se ne broje.
 * Bez pristupa bazi, pa se lako proverava.
 */

export type ReportRow = { label: string; orders: number; qty: number; amount: number };

export type Report = {
  /** Prvi i poslednji dan perioda, "GGGG-MM-DD", po vremenu prodavnice. */
  from: string;
  to: string;
  orders: number;
  cancelled: number;
  /** Vrednost prodatih proizvoda posle popusta, bez dostave i bez vraćenog novca. */
  sales: number;
  delivery: number;
  discounts: number;
  refunded: number;
  /** Naplaćeno ukupno: proizvodi i dostava, umanjeno za povraćaje. */
  revenue: number;
  pieces: number;
  average: number | null;
  days: { day: string; orders: number; sales: number }[];
  products: ReportRow[];
  payments: ReportRow[];
  deliveries: ReportRow[];
  discountsUsed: ReportRow[];
};

function add(map: Map<string, ReportRow>, label: string, qty: number, amount: number) {
  const row = map.get(label) ?? { label, orders: 0, qty: 0, amount: 0 };
  row.orders += 1;
  row.qty += qty;
  row.amount += amount;
  map.set(label, row);
}

const sorted = (map: Map<string, ReportRow>) => [...map.values()].sort((a, b) => b.amount - a.amount || b.orders - a.orders);

/** Dan porudžbine po vremenu prodavnice, npr. "2026-10-03". */
function dayOf(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
}

export function isDay(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Period iz adrese; bez ispravnih datuma, poslednjih 30 dana zaključno sa danas. */
export function reportPeriod(from: string | undefined, to: string | undefined, timeZone: string, now = new Date()) {
  const today = dayOf(now.toISOString(), timeZone);
  const end = isDay(to) ? to : today;
  const start = isDay(from) && from <= end ? from : dayOf(new Date(Date.parse(end) - 29 * 86_400_000).toISOString(), "UTC");
  return { from: start, to: end };
}

export function buildReport(orders: Order[], period: { from: string; to: string }, timeZone: string): Report {
  const inPeriod = orders.filter((order) => {
    const day = dayOf(order.receivedAt, timeZone);
    return day >= period.from && day <= period.to;
  });
  const valid = inPeriod.filter((order) => order.status !== "cancelled");

  const days = new Map<string, { day: string; orders: number; sales: number }>();
  const products = new Map<string, ReportRow>();
  const payments = new Map<string, ReportRow>();
  const deliveries = new Map<string, ReportRow>();
  const discountsUsed = new Map<string, ReportRow>();
  let sales = 0;
  let delivery = 0;
  let discounts = 0;
  let refunded = 0;
  let pieces = 0;

  for (const order of valid) {
    const discount = order.discount?.amount ?? 0;
    const value = Math.max(0, order.subtotal - discount - order.refunded);
    const qty = order.items.reduce((sum, item) => sum + item.qty, 0);
    sales += value;
    delivery += order.delivery;
    discounts += discount;
    refunded += order.refunded;
    pieces += qty;

    const day = dayOf(order.receivedAt, timeZone);
    const entry = days.get(day) ?? { day, orders: 0, sales: 0 };
    entry.orders += 1;
    entry.sales += value;
    days.set(day, entry);

    for (const item of order.items) add(products, itemName(item), item.qty, item.price * item.qty);
    add(payments, paymentLabels[order.paymentMethod], qty, order.total);
    add(deliveries, order.deliveryMethod || "Dostava", qty, order.delivery);
    if (order.discount) add(discountsUsed, discountText(order.discount), qty, discount);
  }

  return {
    ...period,
    orders: valid.length,
    cancelled: inPeriod.length - valid.length,
    sales,
    delivery,
    discounts,
    refunded,
    revenue: valid.reduce((sum, order) => sum + order.total - order.refunded, 0),
    pieces,
    average: valid.length > 0 ? Math.round(sales / valid.length) : null,
    days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    // Kod proizvoda „orders" je broj stavki, a redosled je po prodatom iznosu.
    products: sorted(products),
    payments: sorted(payments),
    deliveries: sorted(deliveries),
    discountsUsed: sorted(discountsUsed),
  };
}
