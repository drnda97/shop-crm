"use client";

import { usePath } from "@/lib/i18n/client";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { countLabel, formatPrice } from "@/lib/storefront/products";
import { cartKey, defaultMethod, shippingFor, useCart } from "./cart";
import { CheckIcon, Photo } from "./ui";

export function CartDrawer() {
  const to = usePath();
  const t = useT();
  const { products, config, items, count, subtotal, weight, closeCart, add, setQty } = useCart();
  // Korpa računa dostavu podrazumevanim načinom; kupac ga menja na stranici plaćanja.
  const { isFree, price: shipping, remaining, pct, freeFrom } = shippingFor(defaultMethod(config), subtotal, weight);
  const texts = config.texts.cart;
  // Predlog do besplatne dostave: proizvod izabran u panelu, inače najjeftiniji iz kataloga.
  // Nudi se samo proizvod bez varijanti, jer se dodaje jednim klikom.
  const simple = products.filter((p) => p.variants.length === 0);
  const upsell =
    simple.find((p) => p.slug === texts.upsell) ?? [...simple].sort((a, b) => a.price - b.price)[0];

  return (
    <div className="ds cart" style={{ fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--paper)" }}>
      <div className="cart-top">
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2 className="display" style={{ fontSize: "26px" }}>{t("Vaša korpa")}</h2>
          <span className="muted" style={{ fontSize: "15px" }}>{t(countLabel(count))}</span>
        </div>
        <button className="icon-btn" aria-label={t("Zatvori korpu")} onClick={closeCart} style={{ background: "var(--mist)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round">
            <path d="M2 2l12 12M14 2L2 14"></path>
          </svg>
        </button>
      </div>

      <div className="ship" hidden={freeFrom === null}>
        {!isFree && (
          <div style={{ fontSize: "15px" }}>
            {t("Još")} <strong>{formatPrice(remaining)}</strong> {t("do besplatne dostave")}
          </div>
        )}
        {isFree && (
          <div style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckIcon />
            <span>
              {t("Dostava je")} <strong>{t("besplatna")}</strong>
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
            <Link className="btn ghost" href={to("/kolekcija")} onClick={closeCart} style={{ marginTop: "8px" }}>
              {t("Pogledajte kolekciju")}
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
                  <Link className="card-name" href={to(`/proizvod/${it.slug}`)} style={{ fontSize: "17px" }}>
                    {it.name}
                  </Link>
                  <span style={{ fontFamily: "var(--display)", fontSize: "16px", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {formatPrice(it.price * it.qty)}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: "14px" }}>{it.variant}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <div className="qty">
                    <button aria-label={t("Smanji količinu")} onClick={() => setQty(key, -1)}>−</button>
                    <span>{it.qty}</span>
                    <button aria-label={t("Povećaj količinu")} onClick={() => setQty(key, 1)}>+</button>
                  </div>
                  <button className="txt-btn" onClick={() => setQty(key, -it.qty)}>{t("Ukloni")}</button>
                </div>
              </div>
            </div>
          );
        })}

        {count > 0 && !isFree && freeFrom !== null && upsell && (
          <div style={{ padding: "18px 0" }}>
            <div className="lab" style={{ marginBottom: "12px" }}>{t("Dodajte ovo i dostava je besplatna")}</div>
            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <div className="ph" style={{ width: "60px", height: "72px", flexShrink: 0, borderRadius: "14px" }}>
                {upsell.image && <Photo src={upsell.image} alt="" sizes="60px" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="card-name" style={{ fontSize: "16.5px" }}>{upsell.name}</div>
                <div className="muted" style={{ fontSize: "14px" }}>{formatPrice(upsell.price)}</div>
              </div>
              <button className="chip" onClick={() => add({ slug: upsell.slug, variant: upsell.variant })}>
                {t("Dodaj")}
              </button>
            </div>
          </div>
        )}
      </div>

      {count > 0 && (
        <div className="cart-foot">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", color: "var(--soft)" }}>
            <span>{t("Dostava")}</span>
            <span>{isFree ? t("Besplatna") : formatPrice(shipping)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="lab">{t("Ukupno")}</span>
            <span className="display" style={{ fontSize: "28px" }}>{formatPrice(subtotal + shipping)}</span>
          </div>
          <Link className="btn gold full" href={to("/placanje")}>{t("Nastavi na plaćanje")}</Link>
          {texts.footNote && <div className="muted" style={{ fontSize: "13.5px", textAlign: "center" }}>{texts.footNote}</div>}
        </div>
      )}
    </div>
  );
}
