"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart";
import { ProductCard } from "./product-card";

type ProductsBlockProps = {
  heading: string;
  /** Id kolekcije iz panela; prazno: svi proizvodi. */
  collection: string;
  limit: number;
  /** Tabovi po kategoriji iznad mreže. */
  tabs: boolean;
  /** U tekstu dugmeta se {broj} menja ukupnim brojem proizvoda. */
  button: { label: string; href: string } | null;
};

/** Sekcija „Proizvodi": mreža proizvoda, po želji sa tabovima po kategoriji. */
export function ProductsBlock({ heading, collection, limit, tabs, button }: ProductsBlockProps) {
  const { products, config } = useCart();
  // Izabrana kategorija (id); prazno: sve. Tabovi su kategorije na vrhu stabla.
  const [cat, setCat] = useState("");
  const tops = config.categories.filter((category) => !category.parent);
  const source = collection ? products.filter((p) => p.collections.includes(collection)) : products;
  const list = source.filter((p) => !tabs || cat === "" || p.categoryIds.includes(cat)).slice(0, limit);

  return (
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(28px, 3.6vw, 48px)" }}>
      <div className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "20px 40px" }}>
        <h2 className="display h-l">{heading}</h2>
        {tabs && (
          <div className="seg" role="group" aria-label="Kategorije">
            {[{ id: "", label: "Sve" }, ...tops].map((c) => (
              <button className={c.id === cat ? "chip on" : "chip"} onClick={() => setCat(c.id)} key={c.id}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid">
        {list.map((p) => (
          <ProductCard product={p} key={p.id} />
        ))}
      </div>
      {button && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link className="btn ghost" href={button.href}>
            {button.label.replace("{broj}", String(products.length))}
          </Link>
        </div>
      )}
    </div>
  );
}
