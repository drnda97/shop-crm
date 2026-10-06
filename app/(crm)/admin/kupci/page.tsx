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
  quietButtonClass,
} from "../ui";

type CustomersPageProps = { searchParams: Promise<{ q?: string; red?: string }> };

const CUSTOMERS_PATH = `${ADMIN_PATH}/kupci`;
const SHOWN = 200;

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  await requireAdmin();
  const { q = "", red } = await searchParams;
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

  return (
    <>
      <PageHeader
        title="Kupci"
        hint={`Kupac se prepoznaje po broju telefona, pa se sve njegove porudžbine vide na jednom mestu. Ukupno kupaca: ${all.length}, od toga je ${returning} poručilo više puta.`}
        action={
          <a href={`${CUSTOMERS_PATH}/izvoz`} className={quietButtonClass}>
            Preuzmi CSV
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
            placeholder="Ime, telefon, email ili mesto"
            aria-label="Pretraga kupaca"
            className={inputClass}
          />
        </div>
        <button type="submit" className={buttonClass}>
          Traži
        </button>
      </form>

      <div className="mb-[16px] flex flex-wrap gap-[8px] text-[14px]">
        {[
          { label: "Poslednji poručili", value: "", current: !bySpent },
          { label: "Najviše potrošili", value: "potrosnja", current: bySpent },
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
              ? "Još nema kupaca. Pojavljuju se ovde sa prvom porudžbinom."
              : "Nema kupaca za ovu pretragu."}
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th className="pb-[8px] font-normal">Kupac</th>
                <th className="pb-[8px] font-normal">Kontakt</th>
                <th className="pb-[8px] font-normal">Porudžbine</th>
                <th className="pb-[8px] text-right font-normal">Potrošeno</th>
                <th className="pb-[8px] text-right font-normal">Poslednja</th>
              </tr>
            </thead>
            <tbody>
              {customers.slice(0, SHOWN).map((customer) => (
                <tr key={customer.key} className="border-t border-line align-top">
                  <td className="py-[10px] pr-[12px]">
                    <Link href={`${CUSTOMERS_PATH}/${customer.key}`} className="underline">
                      {customer.name}
                    </Link>
                    <div className="text-[13px] text-muted">
                      {customer.city}
                      {noted.has(customer.key) && " · ima belešku"}
                    </div>
                  </td>
                  <td className="py-[10px] pr-[12px]">
                    <div>{customer.phone}</div>
                    <div className="text-[13px] text-muted">{customer.email}</div>
                  </td>
                  <td className="py-[10px] pr-[12px]">{formatOrderCount(customer.orderCount)}</td>
                  <td className="py-[10px] pr-[12px] text-right whitespace-nowrap">
                    {formatMoney(customer.spent, currency)}
                  </td>
                  <td className="py-[10px] text-right text-[14px] whitespace-nowrap text-muted">
                    {orderDate(customer.lastOrderAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {customers.length > SHOWN && (
        <p className="mt-[12px] text-[14px] text-muted">
          Prikazano je prvih {SHOWN} od {customers.length}. Suzite spisak pretragom, ili preuzmite
          CSV sa svim kupcima.
        </p>
      )}
    </>
  );
}
