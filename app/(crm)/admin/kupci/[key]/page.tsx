import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { getCustomerNote, getCustomers } from "@/lib/customers";
import { formatMoney, formatOrderCount } from "@/lib/format";
import { getOrders } from "@/lib/order-store";
import { currencyOf } from "@/lib/settings";
import { eraseCustomerAction, saveCustomerNoteAction } from "../../actions";
import { ConfirmButton } from "../../confirm-button";
import { OrdersTable } from "../../orders-table";
import { dateFormats } from "../../order-ui";
import {
  buttonClass,
  cardClass,
  inputClass,
  labelClass,
  PageHeader,
  quietButtonClass,
  textLinkClass,
} from "../../ui";

type CustomerPageProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ ok?: string }>;
};

export default async function CustomerPage({ params, searchParams }: CustomerPageProps) {
  const t = await getPanelT();
  await requireAdmin("orders");
  const [{ key }, { ok }] = await Promise.all([params, searchParams]);
  const [orders, settings, note] = await Promise.all([
    getOrders(),
    getSettings(),
    getCustomerNote(key),
  ]);
  const customer = getCustomers(orders).find((candidate) => candidate.key === key);
  if (!customer) notFound();

  const currency = currencyOf(settings);
  const { orderDate } = dateFormats(settings.store);
  const cancelled = customer.orders.length - customer.orderCount;
  const facts = [
    { label: t("Porudžbine"), value: t(formatOrderCount(customer.orderCount)) },
    { label: t("Potrošeno"), value: formatMoney(customer.spent, currency) },
    {
      label: t("Prosečna porudžbina"),
      value:
        customer.orderCount > 0
          ? formatMoney(Math.round(customer.spent / customer.orderCount), currency)
          : "—",
    },
    { label: t("Prva porudžbina"), value: orderDate(customer.firstOrderAt) },
  ];

  return (
    <>
      <Link href={`${ADMIN_PATH}/kupci`} className={textLinkClass}>
        {t("← Kupci")}
      </Link>
      <div className="mt-[12px]">
        <PageHeader title={customer.name} notice={ok} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-[16px]">
        <div className={`${cardClass} flex flex-col gap-[2px] text-[15px]`}>
          <a href={`tel:${customer.phone.replace(/[^+\d]/g, "")}`} className="underline">
            {customer.phone}
          </a>
          {customer.email && (
            <a href={`mailto:${customer.email}`} className="underline">
              {customer.email}
            </a>
          )}
          <div>{customer.street}</div>
          <div>
            {customer.postalCode} {customer.city}
          </div>
          <dl className="mt-[12px] grid grid-cols-2 gap-[12px] border-t border-line pt-[12px]">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[13px] text-muted">{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          {cancelled > 0 && (
            <p className="mt-[8px] text-[14px] text-muted">
              {t("Otkazano:")} {t(formatOrderCount(cancelled))}.
            </p>
          )}
        </div>

        <form action={saveCustomerNoteAction} className={`${cardClass} flex flex-col gap-[12px]`}>
          <input type="hidden" name="key" value={customer.key} />
          <label className={labelClass}>
            {t("Beleška o kupcu (vidite je samo vi)")}
            <textarea
              name="note"
              defaultValue={note}
              maxLength={5000}
              className={`${inputClass} min-h-[132px]`}
            />
          </label>
          <div>
            <button type="submit" className={buttonClass}>
              {t("Sačuvaj belešku")}
            </button>
          </div>
        </form>
      </div>

      <div className={`${cardClass} mt-[16px] flex flex-wrap items-center gap-[12px]`}>
        <div className="min-w-[240px] grow text-[15px]">
          <div className="font-display font-bold">{t("Podaci na zahtev kupca")}</div>
          <div className="text-[14px] text-muted">
            {t("Izvoz daje sve što prodavnica čuva o kupcu. Brisanje uklanja nalog, poruke, prijavu na novosti i belešku, a iz porudžbina ime, kontakt i adresu; same porudžbine ostaju kao evidencija prodaje.")}
          </div>
        </div>
        <a href={`${ADMIN_PATH}/kupci/${customer.key}/podaci`} className={quietButtonClass}>
          {t("Izvezi podatke")}
        </a>
        <form action={eraseCustomerAction}>
          <input type="hidden" name="key" value={customer.key} />
          <ConfirmButton question={t("Obrisati podatke kupca „{a}\"?", { a: customer.name })} className={quietButtonClass}>
            {t("Obriši podatke")}
          </ConfirmButton>
        </form>
      </div>

      <h2 className="mt-[24px] mb-[12px] text-[20px]">{t("Porudžbine")}</h2>
      <OrdersTable orders={customer.orders} currency={currency} date={orderDate} hideCustomer />
    </>
  );
}
