import { orderStatusLabels, type OrderStatus } from "@/lib/orders";
import type { StoreSettings } from "@/lib/settings";

/** Sitni delovi koje dele Pregled, Porudžbine i Kupci. */

/** Datumi po jeziku i vremenskoj zoni prodavnice (Podešavanja → Prodavnica). */
export function dateFormats(store: StoreSettings) {
  const dateTime = new Intl.DateTimeFormat(store.locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: store.timeZone,
  });
  const day = new Intl.DateTimeFormat(store.locale, {
    day: "numeric",
    month: "short",
    timeZone: store.timeZone,
  });
  return {
    orderDate: (iso: string) => dateTime.format(new Date(iso)),
    shortDay: (date: Date) => day.format(date),
  };
}

const statusClasses: Record<OrderStatus, string> = {
  new: "bg-accent text-paper",
  confirmed: "border border-accent text-accent",
  shipped: "border border-line-strong text-ink",
  delivered: "bg-ink text-paper",
  cancelled: "border border-line text-muted line-through",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-[10px] text-[12px] leading-[22px] whitespace-nowrap ${statusClasses[status]}`}
    >
      {orderStatusLabels[status]}
    </span>
  );
}
