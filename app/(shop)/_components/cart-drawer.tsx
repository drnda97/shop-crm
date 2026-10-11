"use client";

import Link from "next/link";
import { countLabel, formatPrice } from "@/lib/storefront/products";
import { cartKey, shippingFor, useCart } from "./cart";
import { CheckIcon, Photo } from "./ui";

export function CartDrawer() {
  const { products, config, items, count, subtotal, closeCart, add, setQty } = useCart();
  const { isFree, price: shipping, remaining, pct } = shippingFor(config, subtotal);
  const texts = config.texts.cart;
  // Predlog do besplatne dostave: proizvod izabran u panelu, inače najjeftiniji iz kataloga.
  const upsell =
    products.find((p) => p.slug === texts.upsell) ?? [...products].sort((a, b) => a.price - b.price)[0];

  return (
    <div className="ds cart" style={{ fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--paper)" }}>
      <div className="cart-top">
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2 className="display" style={{ fontSize: "26px" }}>Vaša korpa</h2>
          <span className="muted" style={{ fontSize: "15px" }}>{countLabel(count)}</span>
        </div>
        <button className="icon-btn" aria-label="Zatvori korpu" onClick={closeCart} style={{ background: "var(--mist)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round">
            <path d="M2 2l12 12M14 2L2 14"></path>
          </svg>
        </button>
      </div>

      <div className="ship" hidden={config.freeFrom === null}>
        {!isFree && (
          <div style={{ fontSize: "15px" }}>
            Još <strong>{formatPrice(remaining)}</strong> do besplatne dostave
          </div>
        )}
        {isFree && (
          <div style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckIcon />
            <span>
              Dostava je <strong>besplatna</strong>
            </span>
          </div>
        )}
        <div className="ship-track">
          <div className="ship-fill" style={{ width: pct }}></div>
        </div>
      </div>

      <div className="cart-list">
        {count === 0 && (
          <div style={{ padding: "64px 0", textAlign: "center", display: "flex", flexDirection: "column", gap: "14px", alignItems: "center" }}>
            <div className="display" style={{ fontSize: "26px" }}>{texts.emptyHeading}</div>
            {texts.emptyText && (
              <p className="muted" style={{ fontSize: "15.5px", maxWidth: "28ch" }}>{texts.emptyText}</p>
            )}
            <Link className="btn ghost" href="/kolekcija" onClick={closeCart} style={{ marginTop: "8px" }}>
              Pogledajte kolekciju
            </Link>
          </div>
        )}
        {items.map((it) => {
          const key = cartKey(it);
          return (
            <div className="cart-item" key={key}>
              <div className="ph cart-thumb">
                {it.image && <Photo src={it.image} alt="" sizes="88px" />}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <Link className="card-name" href={`/proizvod/${it.slug}`} style={{ fontSize: "17px" }}>
                    {it.name}
                  </Link>
                  <span style={{ fontFamily: "var(--display)", fontSize: "16px", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {formatPrice(it.price * it.qty)}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: "14px" }}>{it.variant}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <div className="qty">
                    <button aria-label="Smanji količinu" onClick={() => setQty(key, -1)}>−</button>
                    <span>{it.qty}</span>
                    <button aria-label="Povećaj količinu" onClick={() => setQty(key, 1)}>+</button>
                  </div>
                  <button className="txt-btn" onClick={() => setQty(key, -it.qty)}>Ukloni</button>
                </div>
              </div>
            </div>
          );
        })}

        {count > 0 && !isFree && config.freeFrom !== null && upsell && (
          <div style={{ padding: "18px 0" }}>
            <div className="lab" style={{ marginBottom: "12px" }}>Dodajte ovo i dostava je besplatna</div>
            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <div className="ph" style={{ width: "60px", height: "72px", flexShrink: 0, borderRadius: "14px" }}>
                {upsell.image && <Photo src={upsell.image} alt="" sizes="60px" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="card-name" style={{ fontSize: "16.5px" }}>{upsell.name}</div>
                <div className="muted" style={{ fontSize: "14px" }}>{formatPrice(upsell.price)}</div>
              </div>
              <button className="chip" onClick={() => add({ slug: upsell.slug, variant: upsell.variant })}>
                Dodaj
              </button>
            </div>
          </div>
        )}
      </div>

      {count > 0 && (
        <div className="cart-foot">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", color: "var(--soft)" }}>
            <span>Dostava</span>
            <span>{isFree ? "Besplatna" : formatPrice(shipping)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="lab">Ukupno</span>
            <span className="display" style={{ fontSize: "28px" }}>{formatPrice(subtotal + shipping)}</span>
          </div>
          <Link className="btn gold full" href="/placanje">Nastavi na plaćanje</Link>
          {texts.footNote && <div className="muted" style={{ fontSize: "13.5px", textAlign: "center" }}>{texts.footNote}</div>}
        </div>
      )}
    </div>
  );
}
