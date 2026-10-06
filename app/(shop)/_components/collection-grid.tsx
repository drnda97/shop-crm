"use client";

import { useState } from "react";
import { countLabel } from "@/lib/storefront/products";
import { useCart } from "./cart";
import { ProductCard } from "./product-card";

type Sort = "rec" | "asc" | "desc";

/** Koliko proizvoda se vidi pre „Učitaj još". */
const PAGE = 8;

export function CollectionGrid({ initialCategory, search }: { initialCategory: string; search: boolean }) {
  const { products, config } = useCart();
  const [cat, setCat] = useState(initialCategory);
  const [sort, setSort] = useState<Sort>("rec");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);

  const q = query.trim().toLowerCase();
  let list = products.filter((p) => cat === "Sve" || p.category === cat);
  if (q) list = list.filter((p) => `${p.name} ${p.category} ${p.variant}`.toLowerCase().includes(q));
  if (sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
  if (sort === "desc") list = [...list].sort((a, b) => b.price - a.price);
  const n = list.length;
  const shown = Math.min(visible, n);

  return (
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(24px, 3vw, 40px)" }}>
      {search && (
        <div className="f a3">
          <label htmlFor="search">Pretraga</label>
          <input
            id="search"
            type="search"
            placeholder="Naziv, kategorija ili tkanina"
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE);
            }}
            style={{ borderRadius: "999px", padding: "14px 24px" }}
          />
        </div>
      )}

      <div className="a3" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "14px 24px" }}>
        <div className="seg" role="group" aria-label="Filter po kategoriji">
          {config.categories.map((c) => (
            <button
              className={c === cat ? "chip on" : "chip"}
              onClick={() => {
                setCat(c);
                setVisible(PAGE);
              }}
              key={c}
            >
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <span className="muted" style={{ fontSize: "15px" }}>{countLabel(n)}</span>
          <div className="f" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
            <label htmlFor="sort">Sortiraj</label>
            <select
              id="sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              style={{ width: "auto", minHeight: "48px", padding: "8px 16px", borderRadius: "999px", fontSize: "15px", cursor: "pointer" }}
            >
              <option value="rec">Preporučeno</option>
              <option value="asc">Cena: rastuće</option>
              <option value="desc">Cena: opadajuće</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))" }}>
        {list.slice(0, shown).map((p) => (
          <ProductCard product={p} key={p.id} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", paddingTop: "16px" }}>
        {n === 0 ? (
          <span className="muted" style={{ fontSize: "15px" }}>Nema proizvoda za ovu pretragu.</span>
        ) : (
          <>
            <span className="muted" style={{ fontSize: "15px" }}>
              Prikazano {shown} od {countLabel(n)}
            </span>
            <div style={{ width: "220px", height: "6px", borderRadius: "3px", background: "#E7E9E4", position: "relative", overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: Math.round((shown / n) * 100) + "%",
                  borderRadius: "3px",
                  background: "#0E2730",
                }}
              ></div>
            </div>
            {shown < n && (
              <button className="btn ghost" type="button" onClick={() => setVisible(visible + PAGE)} style={{ marginTop: "8px" }}>
                Učitaj još
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
