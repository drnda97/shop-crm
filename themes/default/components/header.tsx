"use client";

import { usePath } from "@/lib/i18n/client";
import { useT } from "@/lib/i18n/client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart";
import { CartDrawer } from "./cart-drawer";
import { LangSwitch } from "./lang-switch";

export function Header({ overlay = false }: { overlay?: boolean }) {
  const to = usePath();
  const t = useT();
  const [menu, setMenu] = useState(false);
  const { config, count, open, openCart, closeCart } = useCart();

  return (
    <header
      className={overlay ? "ds hdr over" : "ds hdr"}
      style={{ fontFamily: "var(--sans)", color: "var(--ink)", background: "transparent" }}
    >
      <div className="wrap">
        <div className="pill-nav">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button className="icon-btn menu-btn" aria-label={t("Meni")} aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round">
                <path d="M1 1h18M1 7h18M1 13h11"></path>
              </svg>
            </button>
            <Link className="logo" href={to("/")}>
              {config.logo ? (
                <Image src={config.logo} alt={config.storeName} width={160} height={36} style={{ width: "auto", height: "36px" }} />
              ) : (
                <>
                  <b></b>
                  {config.storeName}
                </>
              )}
            </Link>
          </div>
          <nav className="nav-links" aria-label={t("Glavna navigacija")}>
            {config.menu.map((item, index) => (
              <Link className="ul" href={to(item.href)} key={index}>{item.label}</Link>
            ))}
          </nav>
          <div className="nav-right">
            <LangSwitch />
            <Link className="icon-btn hide-s" href={to("/kolekcija?pretraga=1")} aria-label={t("Pretraga")}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round">
                <circle cx="8.500" cy="8.500" r="6.500"></circle>
                <path d="M13.500 13.500L18.500 18.500"></path>
              </svg>
            </Link>
            <Link className="icon-btn hide-s" href={to("/lista-zelja")} aria-label={t("Lista želja")}>
              <svg width="20" height="18" viewBox="0 0 20 18" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinejoin="round">
                <path d="M10 16.500S1.500 11.700 1.500 6.200A4.200 4.200 0 0110 4.300a4.200 4.200 0 018.500 1.900C18.500 11.700 10 16.500 10 16.500z"></path>
              </svg>
            </Link>
            <Link className="icon-btn" href={to("/nalog")} aria-label={t("Nalog")}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round">
                <circle cx="10" cy="6.500" r="3.800"></circle>
                <path d="M2.500 18.500c1-4 4-5.500 7.500-5.500s6.500 1.500 7.500 5.500"></path>
              </svg>
            </Link>
            <button className="cart-btn" aria-label={t("Otvori korpu")} onClick={openCart}>
              {t("Korpa")} <span>{count}</span>
            </button>
          </div>
        </div>
        <div className={menu ? "mnav open" : "mnav"}>
          <div>
            <nav aria-label={t("Meni")}>
              {config.menu.map((item, index) => (
                <Link href={to(item.href)} key={index}>{item.label}</Link>
              ))}
              <Link href={to("/lista-zelja")}>{t("Lista želja")}</Link>
              <Link href={to("/pracenje")}>{t("Praćenje porudžbine")}</Link>
              <Link href={to("/nalog")}>{t("Moj nalog")}</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className={open ? "drawer open" : "drawer"}>
        <button className="drawer-scrim" aria-label={t("Zatvori korpu")} onClick={closeCart}></button>
        <aside className="drawer-panel" aria-label={t("Korpa")}>
          <CartDrawer />
        </aside>
      </div>
    </header>
  );
}
