import type { Metadata } from "next";
import { getSettings } from "@/lib/content";
import { orderStatusLabels } from "@/lib/orders";
import { paymentLabels } from "@/lib/settings";
import { getCurrentUser, getUserOrders } from "@/lib/storefront/auth";
import { getWelcomeCode } from "@/lib/storefront/catalog";
import { AccountPanel, type Account } from "../_components/account-panel";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { DS_STYLE, Photo } from "../_components/ui";

export const metadata: Metadata = { title: "Demo Shop — Prijava i registracija" };

/** Prijavljeni kupac sa porudžbinama iz CRM-a, ili null. */
async function loadAccount(): Promise<Account | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [orders, settings, welcomeCode] = await Promise.all([
    getUserOrders(user.id),
    getSettings(),
    getWelcomeCode(),
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
    orders: orders.map((order) => ({
      number: order.number,
      date: date.format(new Date(order.receivedAt)),
      status: orderStatusLabels[order.status],
      payment: paymentLabels[order.paymentMethod],
      total: order.total,
      count: order.items.reduce((sum, item) => sum + item.qty, 0),
      names: order.items.map((item) => item.name).join(", "),
    })),
  };
}

export default async function AccountPage() {
  const account = await loadAccount();

  return (
    <div className="ds" style={DS_STYLE}>
      <Header />

      <section style={{ padding: "16px 0 clamp(56px, 7vw, 104px)" }}>
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(400px, 100%), 1fr))",
            gap: "clamp(24px, 4vw, 72px)",
            alignItems: "stretch",
          }}
        >
          {/* SLIKA */}
          <div className="ph" style={{ borderRadius: "36px", minHeight: "clamp(300px, 52vw, 760px)", color: "#FFFFFF", background: "#0A1E25" }}>
            <Photo className="img kb" src="/shop/ds-cognac.jpg" alt="Kožna sofa sa žutim jastukom" sizes="(max-width: 900px) 100vw, 640px" preload />
            <div style={{ position: "absolute", inset: 0, background: "rgba(8, 22, 28, .3)" }}></div>
            <div
              style={{
                position: "absolute",
                left: "clamp(22px, 3vw, 44px)",
                right: "clamp(22px, 3vw, 44px)",
                bottom: "clamp(22px, 3vw, 44px)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div className="display h-m a1" style={{ maxWidth: "15ch" }}>Sve vaše porudžbine na jednom mestu</div>
              <p className="a2" style={{ color: "#DDE5E6", maxWidth: "38ch" }}>
                Pratite isporuku, sačuvajte omiljene modele i poručite uzorke tkanina.
              </p>
            </div>
          </div>

          {/* FORMA */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "clamp(8px, 2vw, 32px) 0" }}>
            <AccountPanel account={account} />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
