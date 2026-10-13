"use client";

import { useT } from "@/lib/i18n/client";
import { useState } from "react";
import { formatPrice, type ShopProduct } from "@/lib/storefront/products";
import { track } from "./analytics";
import { useCart } from "./cart";
import { Icon, Photo } from "./ui";
import { WishButton } from "./wishlist";

/**
 * Gornji deo stranice proizvoda: galerija, opcije, količina i dodavanje u korpu.
 * Opis, slike, opcije i dodatne sekcije su iz proizvoda u panelu; napomena uz cenu, prednosti
 * i obaveštenja za sve proizvode iz Izgled sajta → Proizvod.
 */
export function ProductView({ product }: { product: ShopProduct }) {
  const t = useT();
  const { add, config } = useCart();
  const texts = config.texts.product;
  const [shot, setShot] = useState(-1);
  // Izabrana vrednost svake opcije; na početku prva.
  const [picked, setPicked] = useState<number[]>(product.options.map(() => 0));
  const [qty, setQty] = useState(1);
  const [acc, setAcc] = useState(0);

  const shots = [product.image, ...product.gallery].flatMap((image) => (image ? [image] : []));
  const accs = [...product.attributes, ...texts.info].filter((item) => item.title);

  // Izabrane vrednosti opcija određuju varijantu: njena cena, stanje i slika važe za dodavanje u korpu.
  const hasVariants = product.variants.length > 0;
  const variant = product.variants.find((candidate) =>
    candidate.values.every((value, index) => product.options[index]?.values[picked[index]]?.label === value),
  );
  const price = hasVariants ? (variant?.price ?? product.price) : product.price;
  const oldPrice = hasVariants ? variant?.oldPrice : product.oldPrice;
  // Kombinacija koja se ne pravi ili je rasprodata ne može u korpu.
  const canAdd = !hasVariants || variant?.available === true;
  // „Još samo 2 kom.": za izabranu varijantu, ili za proizvod bez varijanti.
  const lowStock = hasVariants ? (variant?.available ? variant.lowStock : null) : product.lowStock;
  const limit = hasVariants ? (variant?.maxQty ?? 1) : Infinity;
  const amount = Math.max(1, Math.min(qty, limit));
  // Dok kupac ne klikne na sličicu (shot je -1), prikazuje se slika izabrane varijante.
  const image = shots[shot] ?? (variant?.image && shots.includes(variant.image) ? variant.image : shots[0]);

  function pick(index: number, value: number) {
    setPicked((items) => items.map((item, position) => (position === index ? value : item)));
    setShot(-1);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))",
        gap: "clamp(28px, 4.5vw, 72px)",
        alignItems: "start",
      }}
    >
      {/* GALERIJA */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="ph zoom" style={{ aspectRatio: "1", borderRadius: "32px" }}>
          {image && <Photo src={image} alt={product.name} sizes="(max-width: 900px) 100vw, 620px" preload />}
          {product.tag && (
            <span className={product.oldPrice ? "tag sale" : "tag"} style={{ top: "18px", left: "18px" }}>
              {t(product.tag)}
            </span>
          )}
        </div>
        {shots.length > 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
            {shots.map((src, i) => (
              <button className={src === image ? "thumb on" : "thumb"} aria-label={t("Slika {a}", { a: i + 1 })} onClick={() => setShot(i)} key={src}>
                <Photo src={src} alt="" sizes="150px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PODACI */}
      <div className="sticky" style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="muted a1" style={{ fontSize: "15px" }}>{product.category}</div>
          <h1 className="display" style={{ fontSize: "clamp(34px, 3.8vw, 54px)" }}>
            <span className="ln"><span>{product.name}</span></span>
          </h1>
          <div className="a2" style={{ display: "flex", alignItems: "baseline", gap: "14px", flexWrap: "wrap" }}>
            <span className="display" style={{ fontSize: "28px" }}>{formatPrice(price)}</span>
            {oldPrice && <s className="muted">{formatPrice(oldPrice)}</s>}
            {texts.priceNote && <span className="muted" style={{ fontSize: "14.5px" }}>{texts.priceNote}</span>}
          </div>
        </div>
        {lowStock && (
          <div className="lab a2" role="status" style={{ color: "var(--gold-d)" }}>{t(lowStock)}</div>
        )}
        {product.description && (
          <p className="lead a2" style={{ whiteSpace: "pre-line" }}>{product.description}</p>
        )}

        {product.options.map((option, index) => {
          const current = option.values[picked[index]];
          // Opcija čije sve vrednosti imaju boju prikazuje se kao kružići, inače kao dugmad.
          const swatches = option.values.every((value) => value.color);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: swatches ? "8px" : "10px" }} key={option.name}>
              <div className="lab">
                {option.name}
                {swatches && current && <>: <span className="muted" style={{ fontWeight: 500 }}>{current.label}</span></>}
              </div>
              {swatches ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginLeft: "-4px" }}>
                  {option.values.map((value, i) => (
                    <button className={i === picked[index] ? "sw on" : "sw"} aria-label={value.label} aria-pressed={i === picked[index]} onClick={() => pick(index, i)} key={value.label}>
                      <i style={{ background: value.color }}></i>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {option.values.map((value, i) => (
                    <button className={i === picked[index] ? "chip on" : "chip"} aria-pressed={i === picked[index]} onClick={() => pick(index, i)} key={value.label}>
                      {value.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <div className="qty" style={{ height: "58px", padding: "0 6px" }}>
            <button aria-label={t("Smanji količinu")} onClick={() => setQty(Math.max(1, amount - 1))}>−</button>
            <span>{amount}</span>
            <button aria-label={t("Povećaj količinu")} disabled={amount >= limit} onClick={() => setQty(amount + 1)}>+</button>
          </div>
          <button
            className="btn gold"
            style={{ flex: "1 1 240px" }}
            disabled={!canAdd}
            onClick={() => {
              add({ slug: product.slug, variant: variant?.label ?? product.variant, variantId: variant?.id, qty: amount, product });
              track("add_to_cart", { value: price * amount, currency: "RSD" });
            }}
          >
            {canAdd ? t("Dodaj u korpu, {cena}", { cena: formatPrice(price * amount) }) : t("Nema na stanju")}
          </button>
          <span style={{ display: "flex", alignItems: "center", height: "58px" }}>
            <WishButton slug={product.slug} name={product.name} />
          </span>
        </div>

        {texts.notes.length > 0 && (
          <div className="panel" style={{ padding: "18px 22px", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "15.5px" }}>
            {texts.notes.map((note, index) => (
              <div style={{ display: "flex", gap: "14px", alignItems: "center" }} key={index}>
                <Icon name={note.icon} />
                <span>{note.text}</span>
              </div>
            ))}
          </div>
        )}

        {accs.length > 0 && (
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {accs.map((a, i) => (
              <div className={i === acc ? "acc open" : "acc"} key={i}>
                <button className="acc-h sm" aria-expanded={i === acc} onClick={() => setAcc(i === acc ? -1 : i)}>
                  <span>{a.title}</span>
                  <span className="plus"></span>
                </button>
                <div className="acc-b">
                  <div>
                    <p>{a.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
