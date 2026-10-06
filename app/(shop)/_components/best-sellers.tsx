"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart";
import { ProductCard } from "./product-card";

/** „Najprodavanije" na početnoj: tabovi po kategoriji i prva četiri proizvoda. */
export function BestSellers() {
  const { products, config } = useCart();
  const [cat, setCat] = useState("Sve");
  const list = products.filter((p) => cat === "Sve" || p.category === cat).slice(0, 4);

  return (
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(28px, 3.6vw, 48px)" }}>
      <div className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "20px 40px" }}>
        <h2 className="display h-l">Najprodavanije</h2>
        <div className="seg" role="group" aria-label="Kategorije">
          {config.categories.map((c) => (
            <button className={c === cat ? "chip on" : "chip"} onClick={() => setCat(c)} key={c}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid">
        {list.map((p) => (
          <ProductCard product={p} key={p.id} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Link className="btn ghost" href="/kolekcija">
          Pogledajte svih {products.length} proizvoda
        </Link>
      </div>
    </div>
  );
}
