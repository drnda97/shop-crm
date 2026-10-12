import { getPanelT } from "@/lib/i18n/server";
import { hasAccess } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { csvResponse } from "@/lib/csv";
import { fromMinor } from "@/lib/format";
import { getOrders } from "@/lib/order-store";
import { itemName, orderStatusLabels } from "@/lib/orders";
import { paymentLabels } from "@/lib/settings";

/** Sve porudžbine kao CSV, jedna po redu, najnovija prva. */
export async function GET() {
  const t = await getPanelT();
  if (!(await hasAccess("orders"))) return new Response("Not found", { status: 404 });

  const [orders, settings] = await Promise.all([getOrders(), getSettings()]);
  const decimals = settings.store.currencyDecimals;
  const amount = (value: number) => fromMinor(value, decimals).replace(".", ",");

  return csvResponse("porudzbine.csv", [
    [
      t("Broj"),
      t("Datum"),
      t("Status"),
      t("Ime i prezime"),
      t("Telefon"),
      t("Email"),
      t("Ulica"),
      t("Poštanski broj"),
      t("Mesto"),
      t("Napomena kupca"),
      t("Stavke"),
      t("Međuzbir"),
      t("Popust"),
      t("Kod popusta"),
      t("Dostava"),
      t("Ukupno"),
      t("Plaćanje"),
      t("Beleška"),
    ],
    ...orders.reverse().map((order) => [
      order.number,
      order.receivedAt,
      t(orderStatusLabels[order.status]),
      order.customer.name,
      order.customer.phone,
      order.customer.email,
      order.customer.street,
      order.customer.postalCode,
      order.customer.city,
      order.customer.note,
      order.items.map((item) => `${item.qty} × ${itemName(item)}`).join(", "),
      amount(order.subtotal),
      amount(order.discount?.amount ?? 0),
      order.discount ? order.discount.code || order.discount.label : "",
      amount(order.delivery),
      amount(order.total),
      t(paymentLabels[order.paymentMethod]),
      order.adminNote ?? "",
    ]),
  ]);
}
