import { hasAccess } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { csvResponse } from "@/lib/csv";
import { getCustomers } from "@/lib/customers";
import { fromMinor } from "@/lib/format";
import { getOrders } from "@/lib/order-store";

/** Svi kupci kao CSV, npr. za slanje ponuda ili uvoz u drugi program. */
export async function GET() {
  if (!(await hasAccess("orders"))) return new Response("Not found", { status: 404 });

  const [orders, settings] = await Promise.all([getOrders(), getSettings()]);
  const decimals = settings.store.currencyDecimals;

  return csvResponse("kupci.csv", [
    [
      "Ime i prezime",
      "Telefon",
      "Email",
      "Ulica",
      "Poštanski broj",
      "Mesto",
      "Porudžbina",
      "Potrošeno",
      "Prva porudžbina",
      "Poslednja porudžbina",
    ],
    ...getCustomers(orders).map((customer) => [
      customer.name,
      customer.phone,
      customer.email,
      customer.street,
      customer.postalCode,
      customer.city,
      customer.orderCount,
      fromMinor(customer.spent, decimals).replace(".", ","),
      customer.firstOrderAt,
      customer.lastOrderAt,
    ]),
  ]);
}
