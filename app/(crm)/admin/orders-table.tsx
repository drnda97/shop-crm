import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { formatMoney, type Currency } from "@/lib/format";
import { itemName, type Order } from "@/lib/orders";
import { paymentLabels } from "@/lib/settings";
import { StatusBadge } from "./order-ui";
import { cardClass } from "./ui";

type OrdersTableProps = {
  orders: Order[];
  currency: Currency;
  /** Datum porudžbine po podešavanjima prodavnice. */
  date: (iso: string) => string;
  /** Na stranici kupca se kolona Kupac ne prikazuje. */
  hideCustomer?: boolean;
};

/**
 * Porudžbine kao tabela: red po porudžbini, sa onim što treba za pregled. Klik na red otvara
 * Detalje, gde su adresa, stavke, beleška i promena statusa.
 */
export async function OrdersTable({ orders, currency, date, hideCustomer = false }: OrdersTableProps) {
  const t = await getPanelT();
  const head = "px-[14px] py-[12px] font-display text-[13px] font-semibold text-muted";
  const cell = "px-[14px] py-[12px] align-middle";

  return (
    <div className={`${cardClass} overflow-x-auto !p-[8px]`}>
      <table className={`w-full text-left text-[14.5px] ${hideCustomer ? "min-w-[640px]" : "min-w-[820px]"}`}>
        <thead>
          <tr>
            <th className={head}>{t("Porudžbina")}</th>
            {!hideCustomer && <th className={head}>{t("Kupac")}</th>}
            <th className={head}>{t("Proizvodi")}</th>
            <th className={head}>{t("Plaćanje")}</th>
            <th className={`${head} text-right`}>{t("Ukupno")}</th>
            <th className={`${head} text-right`}>{t("Status")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const href = `${ADMIN_PATH}/porudzbine/${order.number}`;
            const [first, ...rest] = order.items;
            const pieces = order.items.reduce((sum, item) => sum + item.qty, 0);
            return (
              // Ceo red vodi na Detalje (link iz prve kolone prekriva red); link na kupca je iznad njega.
              <tr key={order.number} className="relative border-t border-line transition-colors duration-200 hover:bg-band">
                <td className={`${cell} whitespace-nowrap`}>
                  <Link href={href} className="font-display font-bold after:absolute after:inset-0 after:content-['']">
                    #{order.number}
                  </Link>
                  <div className="text-[13px] text-muted">{date(order.receivedAt)}</div>
                </td>
                {!hideCustomer && (
                  <td className={cell}>
                    <Link href={`${ADMIN_PATH}/kupci/${order.customerKey}`} className="relative z-[1] font-medium hover:underline">
                      {order.customer.name}
                    </Link>
                    <div className="text-[13px] text-muted">{order.customer.city}</div>
                  </td>
                )}
                <td className={`${cell} max-w-[320px]`}>
                  <div className="truncate">{first ? `${first.qty} × ${itemName(first)}` : "—"}</div>
                  <div className="text-[13px] text-muted">
                    {rest.length > 0 ? t("+ još {a} · ukupno komada: {b}", { a: rest.length, b: pieces }) : order.deliveryMethod}
                  </div>
                </td>
                <td className={`${cell} whitespace-nowrap`}>
                  <div>{t(paymentLabels[order.paymentMethod])}</div>
                  <div className="text-[13px] text-muted">
                    {order.refunded > 0
                      ? t("vraćeno {a}", { a: formatMoney(order.refunded, currency) })
                      : order.paidAt
                        ? t("plaćeno")
                        : order.paymentMethod !== "cod"
                          ? t("čeka uplatu")
                          : t("pri preuzimanju")}
                  </div>
                </td>
                <td className={`${cell} text-right font-medium whitespace-nowrap`}>{formatMoney(order.total, currency)}</td>
                <td className={`${cell} text-right`}>
                  <StatusBadge status={order.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
