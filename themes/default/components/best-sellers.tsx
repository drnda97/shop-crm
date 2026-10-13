"use client";

import { usePath } from "@/lib/i18n/client";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useState } from "react";
import type { CardProduct } from "@/lib/storefront/products";
import { ProductCard } from "./product-card";

type ProductsBlockProps = {
  heading: string;
  /** Proizvodi koje je server izabrao za sekciju (iz kolekcije ili svi), do broja iz panela. */
  items: CardProduct[];
  /** Tabovi po kategoriji iznad mreže, svaki sa svojim proizvodima; prazno: bez tabova. */
  tabs: { id: string; label: string; items: CardProduct[] }[];
  /** Ukupan broj proizvoda u prodavnici, za {broj} u tekstu dugmeta. */
  total: number;
  button: { label: string; href: string } | null;
};

/** Sekcija „Proizvodi": mreža proizvoda, po želji sa tabovima po kategoriji. */
export function ProductsBlock({ heading, items, tabs, total, button }: ProductsBlockProps) {
  const to = usePath();
  const t = useT();
  // Izabrana kategorija (id); prazno: sve.
  const [cat, setCat] = useState("");
  const list = tabs.find((tab) => tab.id === cat)?.items ?? items;

  return (
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(28px, 3.6vw, 48px)" }}>
      <div className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "20px 40px" }}>
        <h2 className="display h-l">{heading}</h2>
        {tabs.length > 0 && (
          <div className="seg" role="group" aria-label={t("Kategorije")}>
            {[{ id: "", label: t("Sve") }, ...tabs].map((c) => (
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
          <Link className="btn ghost" href={to(button.href)}>
            {button.label.replace("{broj}", String(total))}
          </Link>
        </div>
      )}
    </div>
  );
}
