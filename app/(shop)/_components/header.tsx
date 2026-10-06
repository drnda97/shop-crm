"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart";
import { CartDrawer } from "./cart-drawer";

export function Header({ overlay = false }: { overlay?: boolean }) {
  const [menu, setMenu] = useState(false);
  const { count, open, openCart, closeCart } = useCart();

  return (
    <header
      className={overlay ? "ds hdr over" : "ds hdr"}
      style={{ fontFamily: "var(--sans)", color: "#0E2730", background: "transparent" }}
    >
      <div className="wrap">
        <div className="pill-nav">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button className="icon-btn menu-btn" aria-label="Meni" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round">
                <path d="M1 1h18M1 7h18M1 13h11"></path>
              </svg>
            </button>
            <Link className="logo" href="/">
              <b></b>Demo Shop
            </Link>
          </div>
          <nav className="nav-links" aria-label="Glavna navigacija">
            <Link className="ul" href="/kolekcija">Kolekcija</Link>
            <Link className="ul" href="/o-nama">O nama</Link>
            <Link className="ul" href="/pitanja">Pitanja</Link>
            <Link className="ul" href="/kontakt">Kontakt</Link>
          </nav>
          <div className="nav-right">
            <Link className="icon-btn hide-s" href="/kolekcija?pretraga=1" aria-label="Pretraga">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round">
                <circle cx="8.500" cy="8.500" r="6.500"></circle>
                <path d="M13.500 13.500L18.500 18.500"></path>
              </svg>
            </Link>
            <Link className="icon-btn" href="/nalog" aria-label="Nalog">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round">
                <circle cx="10" cy="6.500" r="3.800"></circle>
                <path d="M2.500 18.500c1-4 4-5.500 7.500-5.500s6.500 1.500 7.500 5.500"></path>
              </svg>
            </Link>
            <button className="cart-btn" aria-label="Otvori korpu" onClick={openCart}>
              Korpa <span>{count}</span>
            </button>
          </div>
        </div>
        <div className={menu ? "mnav open" : "mnav"}>
          <div>
            <nav aria-label="Meni">
              <Link href="/kolekcija">Kolekcija</Link>
              <Link href="/o-nama">O nama</Link>
              <Link href="/pitanja">Česta pitanja</Link>
              <Link href="/kontakt">Kontakt</Link>
              <Link href="/nalog">Moj nalog</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className={open ? "drawer open" : "drawer"}>
        <button className="drawer-scrim" aria-label="Zatvori korpu" onClick={closeCart}></button>
        <aside className="drawer-panel" aria-label="Korpa">
          <CartDrawer />
        </aside>
      </div>
    </header>
  );
}
