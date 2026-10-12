"use client";

import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useState } from "react";
import { countLabel, type ShopCategory, type ShopProduct } from "@/lib/storefront/products";
import { useCart } from "./cart";
import { ProductCard } from "./product-card";

type Sort = "rec" | "asc" | "desc" | "name";

/** Koliko proizvoda se vidi pre „Učitaj još". */
const PAGE = 8;

/** Redovi kategorija: vrh stabla, pa podkategorije svake izabrane kategorije na putu do trenutne. */
function categoryRows(categories: ShopCategory[], current: string): { parent: string; items: ShopCategory[] }[] {
  const path: string[] = [];
  for (let id = current; id && !path.includes(id); id = categories.find((c) => c.id === id)?.parent ?? "") {
    path.unshift(id);
  }
  return ["", ...path]
    .map((parent) => ({ parent, items: categories.filter((category) => category.parent === parent) }))
    .filter((row) => row.items.length > 0);
}

/** Opcije po kojima može da se filtrira: naziv opcije i sve njene vrednosti među prikazanim proizvodima. */
function optionFacets(products: ShopProduct[]): { name: string; values: string[] }[] {
  const facets = new Map<string, Set<string>>();
  for (const product of products) {
    for (const option of product.options) {
      const values = facets.get(option.name) ?? new Set<string>();
      for (const value of option.values) values.add(value.label);
      facets.set(option.name, values);
    }
  }
  return [...facets].map(([name, values]) => ({ name, values: [...values] }));
}

type CollectionGridProps = {
  /** Kategorija čija je ovo stranica (id); prazno: svi proizvodi. */
  initialCategory: string;
  search: boolean;
};

/** Mreža proizvoda sa kategorijama, pretragom, sortiranjem i filterima po ceni i opcijama. */
export function CollectionGrid({ initialCategory: cat, search }: CollectionGridProps) {
  const t = useT();
  const { products, config } = useCart();
  const [sort, setSort] = useState<Sort>("rec");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  // Izabrane vrednosti po opciji: proizvod prolazi ako ima bar jednu od izabranih za svaku opciju.
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  const inCategory = products.filter((p) => cat === "" || p.categoryIds.includes(cat));
  const facets = optionFacets(inCategory);
  const rows = categoryRows(config.categories, cat);
  const path = rows.map((row) => row.parent);

  const q = query.trim().toLowerCase();
  const from = Number(min) || 0;
  const to = Number(max) || Infinity;
  let list = inCategory.filter((p) => p.price >= from && p.price <= to);
  for (const [name, values] of Object.entries(picked)) {
    if (values.length === 0) continue;
    list = list.filter((p) =>
      p.options.some((option) => option.name === name && option.values.some((value) => values.includes(value.label))),
    );
  }
  if (q) list = list.filter((p) => `${p.name} ${p.category} ${p.variant}`.toLowerCase().includes(q));
  if (sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
  if (sort === "desc") list = [...list].sort((a, b) => b.price - a.price);
  if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "sr"));
  const n = list.length;
  const shown = Math.min(visible, n);
  const active = (min ? 1 : 0) + (max ? 1 : 0) + Object.values(picked).reduce((sum, values) => sum + values.length, 0);

  function toggle(name: string, value: string) {
    const current = picked[name] ?? [];
    setPicked({ ...picked, [name]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] });
    setVisible(PAGE);
  }

  function clearFilters() {
    setMin("");
    setMax("");
    setPicked({});
    setVisible(PAGE);
  }

  return (
    <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(24px, 3vw, 40px)" }}>
      {search && (
        <div className="f a3">
          <label htmlFor="search">{t("Pretraga")}</label>
          <input
            id="search"
            type="search"
            placeholder={config.texts.collection.searchPlaceholder}
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

      <div className="a3" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "14px 24px" }}>
        {/* Kategorije su linkovi: svaka ima svoju stranicu, pa adresa može da se podeli. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" }}>
          {rows.map((row, level) => (
            <nav className="seg" aria-label={level === 0 ? "Kategorije" : "Podkategorije"} key={row.parent}>
              {level === 0 && (
                <Link className={cat === "" ? "chip on" : "chip"} href="/kolekcija" scroll={false}>
                  {t("Sve")}
                </Link>
              )}
              {row.items.map((c) => (
                <Link
                  className={c.id === cat || path.includes(c.id) ? "chip on" : "chip"}
                  href={`/kolekcija/${c.id}`}
                  scroll={false}
                  aria-current={c.id === cat ? "page" : undefined}
                  key={c.id}
                >
                  {c.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 18px" }}>
          <span className="muted" style={{ fontSize: "15px" }}>{t(countLabel(n))}</span>
          <button className={filtersOpen || active > 0 ? "chip on" : "chip"} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
            {t("Filteri")}{active > 0 ? ` (${active})` : ""}
          </button>
          <div className="f" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
            <label htmlFor="sort">{t("Sortiraj")}</label>
            <select
              id="sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              style={{ width: "auto", minHeight: "48px", padding: "8px 16px", borderRadius: "999px", fontSize: "15px", cursor: "pointer" }}
            >
              <option value="rec">{t("Preporučeno")}</option>
              <option value="asc">{t("Cena: rastuće")}</option>
              <option value="desc">{t("Cena: opadajuće")}</option>
              <option value="name">{t("Naziv: A–Š")}</option>
            </select>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="panel" style={{ display: "flex", flexWrap: "wrap", gap: "22px 40px", alignItems: "flex-start", padding: "22px 26px" }}>
          <div className="f" style={{ gap: "8px" }}>
            <span className="lab">Cena (RSD)</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="od"
                aria-label={t("Cena od")}
                value={min}
                onChange={(event) => { setMin(event.target.value); setVisible(PAGE); }}
                style={{ width: "120px", borderRadius: "999px", padding: "10px 18px" }}
              />
              <span className="muted">–</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="do"
                aria-label={t("Cena do")}
                value={max}
                onChange={(event) => { setMax(event.target.value); setVisible(PAGE); }}
                style={{ width: "120px", borderRadius: "999px", padding: "10px 18px" }}
              />
            </div>
          </div>
          {facets.map((facet) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} role="group" aria-label={facet.name} key={facet.name}>
              <span className="lab">{facet.name}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {facet.values.map((value) => {
                  const on = (picked[facet.name] ?? []).includes(value);
                  return (
                    <button
                      className={on ? "chip on" : "chip"}
                      aria-pressed={on}
                      onClick={() => toggle(facet.name, value)}
                      style={on ? undefined : { background: "var(--paper)" }}
                      key={value}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {active > 0 && (
            <button className="txt-btn" onClick={clearFilters} style={{ alignSelf: "flex-end" }}>
              {t("Poništi filtere")}
            </button>
          )}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))" }}>
        {list.slice(0, shown).map((p) => (
          <ProductCard product={p} key={p.id} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", paddingTop: "16px" }}>
        {n === 0 ? (
          <span className="muted" style={{ fontSize: "15px" }}>{t("Nema proizvoda za ovaj izbor.")}</span>
        ) : (
          <>
            <span className="muted" style={{ fontSize: "15px" }}>
              {t("Prikazano {a} od {b}", { a: shown, b: t(countLabel(n)) })}
            </span>
            <div style={{ width: "220px", height: "6px", borderRadius: "3px", background: "var(--mist-2)", position: "relative", overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: Math.round((shown / n) * 100) + "%",
                  borderRadius: "3px",
                  background: "var(--ink)",
                }}
              ></div>
            </div>
            {shown < n && (
              <button className="btn ghost" type="button" onClick={() => setVisible(visible + PAGE)} style={{ marginTop: "8px" }}>
                {t("Učitaj još")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
