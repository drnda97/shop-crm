import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { getCustomers, getNotedCustomers } from "@/lib/customers";
import { formatMoney, formatOrderCount } from "@/lib/format";
import { getOrders } from "@/lib/order-store";
import { currencyOf } from "@/lib/settings";
import { dateFormats } from "../order-ui";
import {
  buttonClass,
  cardClass,
  chipClass,
  chipOffClass,
  chipOnClass,
  inputClass,
  PageHeader,
  Pager,
  paginate,
  quietButtonClass,
} from "../ui";

type CustomersPageProps = { searchParams: Promise<{ q?: string; red?: string; strana?: string }> };

const CUSTOMERS_PATH = `${ADMIN_PATH}/kupci`;

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const t = await getPanelT();
  await requireAdmin("orders");
  const { q = "", red, strana } = await searchParams;
  const search = q.trim().toLocaleLowerCase();

  const [orders, settings, noted] = await Promise.all([
    getOrders(),
    getSettings(),
    getNotedCustomers(),
  ]);
  const currency = currencyOf(settings);
  const { orderDate } = dateFormats(settings.store);
  const all = getCustomers(orders);
  const found = all.filter((customer) => {
    if (!search) return true;
    const { name, email, city, phone } = customer;
    return (
      `${name} ${email} ${city}`.toLocaleLowerCase().includes(search) ||
      (/\d{3}/.test(search) &&
        phone.replace(/\D/g, "").includes(search.replace(/\D/g, "") || "x"))
    );
  });
  // Podrazumevano: ko je poslednji poručio. „potrosnja": ko je najviše potrošio.
  const bySpent = red === "potrosnja";
  const customers = bySpent ? [...found].sort((a, b) => b.spent - a.spent) : found;
  const returning = all.filter((customer) => customer.orderCount > 1).length;
  const list = paginate(customers, strana);

  return (
    <>
      <PageHeader
        title={t("Kupci")}
        hint={t("Kupac se prepoznaje po broju telefona, pa se sve njegove porudžbine vide na jednom mestu. Ukupno kupaca: {a}, od toga je {b} poručilo više puta.", { a: all.length, b: returning })}
        action={
          <a href={`${CUSTOMERS_PATH}/izvoz`} className={quietButtonClass}>
            {t("Preuzmi CSV")}
          </a>
        }
      />

      <form action={CUSTOMERS_PATH} className="mb-[12px] flex flex-wrap gap-[8px]">
        {bySpent && <input type="hidden" name="red" value="potrosnja" />}
        <div className="min-w-[220px] grow">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("Ime, telefon, email ili mesto")}
            aria-label={t("Pretraga kupaca")}
            className={inputClass}
          />
        </div>
        <button type="submit" className={buttonClass}>
          {t("Traži")}
        </button>
      </form>

      <div className="mb-[16px] flex flex-wrap gap-[8px] text-[14px]">
        {[
          { label: t("Poslednji poručili"), value: "", current: !bySpent },
          { label: t("Najviše potrošili"), value: "potrosnja", current: bySpent },
        ].map((sort) => {
          const query = new URLSearchParams();
          if (q.trim()) query.set("q", q.trim());
          if (sort.value) query.set("red", sort.value);
          const text = query.toString();
          return (
            <Link
              key={sort.label}
              href={text ? `${CUSTOMERS_PATH}?${text}` : CUSTOMERS_PATH}
              aria-current={sort.current ? "page" : undefined}
              className={`${chipClass} ${sort.current ? chipOnClass : chipOffClass}`}
            >
              {sort.label}
            </Link>
          );
        })}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        {customers.length === 0 ? (
          <p className="text-[15px] text-muted">
            {all.length === 0
              ? t("Još nema kupaca. Pojavljuju se ovde sa prvom porudžbinom.")
              : t("Nema kupaca za ovu pretragu.")}
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th className="pb-[8px] pl-[8px] font-normal">{t("Kupac")}</th>
                <th className="pb-[8px] font-normal">{t("Kontakt")}</th>
                <th className="pb-[8px] font-normal">{t("Porudžbine")}</th>
                <th className="pb-[8px] text-right font-normal">{t("Potrošeno")}</th>
                <th className="pb-[8px] pr-[8px] text-right font-normal">{t("Poslednja")}</th>
              </tr>
            </thead>
            <tbody>
              {list.shown.map((customer) => (
                // Ceo red vodi na stranicu kupca: link sa imena prekriva red.
                <tr key={customer.key} className="relative border-t border-line align-top transition-colors duration-200 hover:bg-band">
                  <td className="py-[10px] pr-[12px] pl-[8px]">
                    <Link href={`${CUSTOMERS_PATH}/${customer.key}`} className="font-medium after:absolute after:inset-0 after:content-['']">
                      {customer.name}
                    </Link>
                    <div className="text-[13px] text-muted">
                      {customer.city}
                      {noted.has(customer.key) && t(" · ima belešku")}
                    </div>
                  </td>
                  <td className="py-[10px] pr-[12px]">
                    <div>{customer.phone}</div>
                    <div className="text-[13px] text-muted">{customer.email}</div>
                  </td>
                  <td className="py-[10px] pr-[12px]">{t(formatOrderCount(customer.orderCount))}</td>
                  <td className="py-[10px] pr-[12px] text-right whitespace-nowrap">
                    {formatMoney(customer.spent, currency)}
                  </td>
                  <td className="py-[10px] pr-[8px] text-right text-[14px] whitespace-nowrap text-muted">
                    {orderDate(customer.lastOrderAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {customers.length > 0 && (
        <Pager
          path={CUSTOMERS_PATH}
          params={{ q: q.trim(), red: red ?? "" }}
          page={list.page}
          pages={list.pages}
          summary={t("Kupaca: {a}", { a: customers.length })}
        />
      )}
    </>
  );
}
