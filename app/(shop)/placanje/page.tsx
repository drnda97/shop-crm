import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/storefront/auth";
import { getShopSettings } from "@/lib/storefront/pages";
import { CheckoutView } from "../_components/checkout-view";
import { DS_STYLE } from "../_components/ui";

export const metadata: Metadata = { title: "Plaćanje", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getShopSettings()]);
  const { name } = settings.store;

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
              <span className="hide-s">Nazad u prodavnicu</span>
            </Link>
            <Link className="logo" href="/">
              <b></b>
              {name}
            </Link>
            <span className="muted" style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1.500" y="8" width="13" height="9" rx="2"></rect>
                <path d="M4.500 8V5a3.500 3.500 0 017 0v3"></path>
              </svg>
              <span className="hide-s">Sigurna kupovina</span>
            </span>
          </div>
        </div>
      </header>

      <CheckoutView
        user={user ? { email: user.email, firstName: user.firstName, lastName: user.lastName } : null}
        key={user?.email ?? ""}
      />
    </div>
  );
}
