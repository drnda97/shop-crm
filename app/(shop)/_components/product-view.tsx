"use client";

import { useState } from "react";
import { formatPrice, type ShopProduct } from "@/lib/storefront/products";
import { useCart } from "./cart";
import { Photo, ShieldIcon, TruckIcon } from "./ui";

// Sadržaj iz dizajna (fotelja Mio). Prikazuje se dok proizvod u CRM-u nema svoj opis,
// sekcije i dodatne slike; tkanine i postolja CRM ne vodi, pa su isti za sve proizvode.
const EXTRA_SHOTS = ["/shop/ds-armchair-plant.jpg", "/shop/ds-detail-b.jpg", "/shop/ds-living-window.jpg"];
const SHOT_LABELS = ["Fotelja spreda", "Fotelja u prostoru", "Detalj drveta", "Dnevna soba"];
const LEAD =
  "Niska fotelja koja se okreće za 360°, sa sedištem od hladno livene pene i postoljem od masivnog hrasta. Dovoljno mala za ugao, dovoljno udobna za celo veče.";
const COLORS = [
  { name: "Pesak", hex: "#B9AB98" },
  { name: "Grafit", hex: "#3C4346" },
  { name: "Maslina", hex: "#6B6A45" },
];
const SIZES = ["Hrast", "Orah", "Crni jasen"];
const ACCS = [
  { title: "Opis", text: "Sedište je oblikovano od hladno livene pene preko čeličnog rama, pa zadržava formu godinama. Okretni mehanizam je skriven u postolju i radi bez zvuka." },
  { title: "Materijali i održavanje", text: "Tkanina: 62% vuna, 38% lan. Postolje: masivni hrast, uljen. Navlaka se skida i pere na 30°C. Drvo brisati suvom krpom i jednom godišnje premazati uljem." },
  { title: "Dostava i povrat", text: "Isporuka za 5 do 10 radnih dana, sa unošenjem i montažom. Dostava je besplatna za porudžbine preko 50.000 RSD, a proizvod možete vratiti u roku od 30 dana." },
];

/** Gornji deo stranice proizvoda: galerija, varijante, količina i dodavanje u korpu. */
export function ProductView({ product }: { product: ShopProduct }) {
  const { add } = useCart();
  const [shot, setShot] = useState(0);
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(0);
  const [qty, setQty] = useState(1);
  const [acc, setAcc] = useState(0);

  const images = [product.image, ...(product.gallery.length > 0 ? product.gallery : EXTRA_SHOTS)].flatMap(
    (image) => (image ? [image] : []),
  );
  const shots = images.map((image, i) => ({ image, label: SHOT_LABELS[i] ?? `Slika ${i + 1}` }));
  const accs = product.attributes.length > 0 ? product.attributes : ACCS;

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
          {shots[shot] && <Photo src={shots[shot].image} alt={product.name} sizes="(max-width: 900px) 100vw, 620px" preload />}
          {product.tag && (
            <span className={product.oldPrice ? "tag sale" : "tag"} style={{ top: "18px", left: "18px" }}>
              {product.tag}
            </span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
          {shots.map((s, i) => (
            <button className={i === shot ? "thumb on" : "thumb"} aria-label={s.label} onClick={() => setShot(i)} key={s.image}>
              <Photo src={s.image} alt="" sizes="150px" />
            </button>
          ))}
        </div>
      </div>

      {/* PODACI */}
      <div className="sticky" style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="muted a1" style={{ fontSize: "15px" }}>{product.category}</div>
          <h1 className="display" style={{ fontSize: "clamp(34px, 3.8vw, 54px)" }}>
            <span className="ln"><span>{product.name}</span></span>
          </h1>
          <div className="a2" style={{ display: "flex", alignItems: "baseline", gap: "14px", flexWrap: "wrap" }}>
            <span className="display" style={{ fontSize: "28px" }}>{formatPrice(product.price)}</span>
            <span className="muted" style={{ fontSize: "14.5px" }}>PDV uračunat</span>
          </div>
        </div>
        <p className="lead a2">{product.description || LEAD}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="lab">
            Tkanina: <span className="muted" style={{ fontWeight: 500 }}>{COLORS[color].name}</span>
          </div>
          <div style={{ display: "flex", gap: "4px", marginLeft: "-4px" }}>
            {COLORS.map((c, i) => (
              <button className={i === color ? "sw on" : "sw"} aria-label={c.name} onClick={() => setColor(i)} key={c.name}>
                <i style={{ background: c.hex }}></i>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div className="lab">Postolje</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {SIZES.map((z, i) => (
              <button className={i === size ? "chip on" : "chip"} onClick={() => setSize(i)} key={z}>
                {z}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <div className="qty" style={{ height: "58px", padding: "0 6px" }}>
            <button aria-label="Smanji količinu" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span>{qty}</span>
            <button aria-label="Povećaj količinu" onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <button
            className="btn gold"
            style={{ flex: "1 1 240px" }}
            onClick={() =>
              add({ slug: product.slug, variant: COLORS[color].name + ", " + SIZES[size].toLowerCase(), qty })
            }
          >
            Dodaj u korpu, {formatPrice(product.price * qty)}
          </button>
        </div>

        <div className="panel" style={{ padding: "18px 22px", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "15.5px" }}>
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <TruckIcon />
            <span>Besplatna dostava za porudžbine preko 50.000 RSD</span>
          </div>
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <ShieldIcon />
            <span>5 godina garancije, povrat u roku od 30 dana</span>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(14, 39, 48, .1)" }}>
          {accs.map((a, i) => (
            <div className={i === acc ? "acc open" : "acc"} key={a.title}>
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
      </div>
    </div>
  );
}
