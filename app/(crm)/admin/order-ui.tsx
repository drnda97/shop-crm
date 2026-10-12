import { getPanelT } from "@/lib/i18n/server";
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
  new: "bg-gold text-ink",
  confirmed: "bg-gold-l/45 text-ink",
  shipped: "bg-band text-ink",
  delivered: "bg-ink text-paper",
  cancelled: "bg-band text-muted line-through",
};

export async function StatusBadge({ status }: { status: OrderStatus }) {
  const t = await getPanelT();
  return (
    <span
      className={`inline-block rounded-full px-[12px] font-display text-[12.5px] leading-[26px] font-bold whitespace-nowrap ${statusClasses[status]}`}
    >
      {t(orderStatusLabels[status])}
    </span>
  );
}
