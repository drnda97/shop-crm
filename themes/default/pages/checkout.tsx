import { getShopT } from "@/lib/i18n/server";
import Link from "next/link";
import type { ComponentProps } from "react";
import { CheckoutView } from "../components/checkout-view";
import { DS_STYLE } from "../components/ui";

export type CheckoutPageProps = {
  storeName: string;
  /** Prijavljen kupac sa adresom sačuvanom uz nalog, koja popunjava formu; null za gosta. */
  user: ComponentProps<typeof CheckoutView>["user"];
};

/** Plaćanje: /placanje. Obračun i slanje porudžbine radi jezgro (akcije u app/(shop)/actions.ts). */
export async function CheckoutPage({ storeName, user }: CheckoutPageProps) {
  const t = await getShopT();
  return (
    <div className="ds" style={DS_STYLE}>
      <header className="hdr">
        <div className="wrap">
          <div className="pill-nav" style={{ width: "100%", padding: "0 24px 0 12px" }}>
            <Link className="more" href="/" style={{ fontSize: "15px" }}>
              <i>
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 5H1M5 1L1 5l4 4"></path>
                </svg>
              </i>
              <span className="hide-s">{t("Nazad u prodavnicu")}</span>
            </Link>
            <Link className="logo" href="/">
              <b></b>
              {storeName}
            </Link>
            <span className="muted" style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1.500" y="8" width="13" height="9" rx="2"></rect>
                <path d="M4.500 8V5a3.500 3.500 0 017 0v3"></path>
              </svg>
              <span className="hide-s">{t("Sigurna kupovina")}</span>
            </span>
          </div>
        </div>
      </header>

      <CheckoutView user={user} key={user?.email ?? ""} />
    </div>
  );
}
