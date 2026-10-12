import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { formatOrderCount } from "@/lib/format";
import { getOrders } from "@/lib/order-store";
import { orderStatusLabels, type OrderStatus } from "@/lib/orders";
import { currencyOf } from "@/lib/settings";
import { OrderCard } from "../order-card";
import { dateFormats } from "../order-ui";
import {
  buttonClass,
  cardClass,
  chipClass,
  chipOffClass,
  chipOnClass,
  inputClass,
  PageHeader,
  quietButtonClass,
} from "../ui";

type OrdersPageProps = {
  searchParams: Promise<{ status?: string; q?: string; strana?: string }>;
};

const statuses = Object.keys(orderStatusLabels) as OrderStatus[];
const PAGE_SIZE = 30;
const ORDERS_PATH = `${ADMIN_PATH}/porudzbine`;

/** Adresa spiska sa zadatim filterima; prazne vrednosti se izostavljaju. */
function listUrl(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `${ORDERS_PATH}?${text}` : ORDERS_PATH;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const t = await getPanelT();
  await requireAdmin("orders");
  const { status, q = "", strana } = await searchParams;
  const active = statuses.find((candidate) => candidate === status);
  const search = q.trim().toLocaleLowerCase();

  const [allOrders, settings] = await Promise.all([getOrders(), getSettings()]);
  const { orderDate } = dateFormats(settings.store);
  // Pretraga po broju porudžbine, imenu, telefonu, emailu i mestu.
  const found = allOrders.reverse().filter((order) => {
    if (!search) return true;
    const { name, phone, email, city } = order.customer;
    return (
      `${order.number} ${name} ${email} ${city}`.toLocaleLowerCase().includes(search) ||
      (/\d{3}/.test(search) &&
        phone.replace(/\D/g, "").includes(search.replace(/\D/g, "") || "x"))
    );
  });
  const orders = active ? found.filter((order) => order.status === active) : found;

  const pages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const page = Math.min(Math.max(Number(strana) || 1, 1), pages);
  const shown = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const back = listUrl({ status: active, q: q.trim(), strana: page > 1 ? String(page) : "" });

  const tabs = [
    { href: listUrl({ q: q.trim() }), label: "Sve", count: found.length, current: !active },
    ...statuses.map((value) => ({
      href: listUrl({ status: value, q: q.trim() }),
      label: orderStatusLabels[value],
      count: found.filter((order) => order.status === value).length,
      current: active === value,
    })),
  ];

  return (
    <>
      <PageHeader
        title={t("Porudžbine")}
        hint={t("Najnovije su na vrhu. Otkazivanje vraća komade na stanje kod proizvoda kojima se vodi broj.")}
        action={
          <div className="flex flex-wrap gap-[8px]">
            <a href={`${ORDERS_PATH}/izvoz`} className={quietButtonClass}>
              {t("Preuzmi CSV")}
            </a>
            <Link href={`${ORDERS_PATH}/nova`} className={buttonClass}>
              {t("+ Nova porudžbina")}
            </Link>
          </div>
        }
      />

      <form action={ORDERS_PATH} className="mb-[12px] flex flex-wrap gap-[8px]">
        {active && <input type="hidden" name="status" value={active} />}
        <div className="min-w-[220px] grow">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("Broj porudžbine, ime, telefon, email ili mesto")}
            aria-label={t("Pretraga porudžbina")}
            className={inputClass}
          />
        </div>
        <button type="submit" className={buttonClass}>
          {t("Traži")}
        </button>
      </form>

      <div className="mb-[16px] flex flex-wrap gap-[8px]">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={`${chipClass} ${tab.current ? chipOnClass : chipOffClass}`}
          >
            {tab.label} ({tab.count})
          </Link>
        ))}
      </div>

      {orders.length === 0 && (
        <p className={`${cardClass} text-[15px] text-muted`}>
          {allOrders.length === 0
            ? "Još nema porudžbina. Čim kupac poruči sa sajta, porudžbina se pojavljuje ovde."
            : "Nema porudžbina za ovaj izbor."}
        </p>
      )}

      <div className="flex flex-col gap-[12px]">
        {shown.map((order) => (
          <OrderCard
            key={order.number}
            order={order}
            currency={currencyOf(settings)}
            date={orderDate(order.receivedAt)}
            back={back}
          />
        ))}
      </div>

      {orders.length > 0 && (
        <div className="mt-[16px] flex flex-wrap items-center gap-[12px] text-[14px] text-muted">
          <span>
            {formatOrderCount(orders.length)}
            {pages > 1 && ` · strana ${page} od ${pages}`}
          </span>
          {page > 1 && (
            <Link
              href={listUrl({ status: active, q: q.trim(), strana: String(page - 1) })}
              className={quietButtonClass}
            >
              {t("← Novije")}
            </Link>
          )}
          {page < pages && (
            <Link
              href={listUrl({ status: active, q: q.trim(), strana: String(page + 1) })}
              className={quietButtonClass}
            >
              {t("Starije →")}
            </Link>
          )}
        </div>
      )}
    </>
  );
}
