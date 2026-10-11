import { isAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { csvResponse } from "@/lib/csv";
import { fromMinor } from "@/lib/format";
import { getOrders } from "@/lib/order-store";
import { itemName, orderStatusLabels } from "@/lib/orders";
import { paymentLabels } from "@/lib/settings";

/** Sve porudžbine kao CSV, jedna po redu, najnovija prva. */
export async function GET() {
  if (!(await isAdmin())) return new Response("Not found", { status: 404 });

  const [orders, settings] = await Promise.all([getOrders(), getSettings()]);
  const decimals = settings.store.currencyDecimals;
  const amount = (value: number) => fromMinor(value, decimals).replace(".", ",");

  return csvResponse("porudzbine.csv", [
    [
      "Broj",
      "Datum",
      "Status",
      "Ime i prezime",
      "Telefon",
      "Email",
      "Ulica",
      "Poštanski broj",
      "Mesto",
      "Napomena kupca",
      "Stavke",
      "Međuzbir",
      "Popust",
      "Kod popusta",
      "Dostava",
      "Ukupno",
      "Plaćanje",
      "Beleška",
    ],
    ...orders.reverse().map((order) => [
      order.number,
      order.receivedAt,
      orderStatusLabels[order.status],
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
      order.discount?.code ?? "",
      amount(order.delivery),
      amount(order.total),
      paymentLabels[order.paymentMethod],
      order.adminNote ?? "",
    ]),
  ]);
}
