import { getShopT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { itemName, orderStatusLabels } from "@/lib/orders";
import { paymentLabels } from "@/lib/settings";
import { getAddress, getCurrentUser, getUserOrders } from "@/lib/storefront/auth";
import { getWelcomeCode } from "@/lib/storefront/catalog";
import { getShopSettings } from "@/lib/storefront/pages";
import { AccountPage, type Account } from "@theme/pages/account";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getShopT())("Prijava i registracija"), robots: { index: false, follow: false } };
}

/** Prijavljeni kupac sa porudžbinama iz CRM-a, ili null. */
async function loadAccount(): Promise<Account | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [orders, settings, welcomeCode, address] = await Promise.all([
    getUserOrders(user.id),
    getShopSettings(),
    getWelcomeCode(),
    getAddress(user.id),
  ]);
  const date = new Intl.DateTimeFormat(settings.store.locale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: settings.store.timeZone,
  });
  return {
    firstName: user.firstName,
    email: user.email,
    welcomeCode,
    address,
    orders: orders.map((order) => ({
      number: order.number,
      date: date.format(new Date(order.receivedAt)),
      status: orderStatusLabels[order.status],
      payment: paymentLabels[order.paymentMethod],
      total: order.total,
      count: order.items.reduce((sum, item) => sum + item.qty, 0),
      names: order.items.map(itemName).join(", "),
    })),
  };
}

export default async function AccountRoute() {
  const [account, settings] = await Promise.all([loadAccount(), getShopSettings()]);
  return <AccountPage account={account} texts={settings.templates.account} />;
}
