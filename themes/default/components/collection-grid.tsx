"use client";

import { usePath } from "@/lib/i18n/client";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { listingSearch, type Listing, type ListingQuery, type Sort } from "@/lib/storefront/collection";
import { countLabel, type CardProduct, type ShopCategory } from "@/lib/storefront/products";
import { useCart } from "./cart";
import { ProductCard } from "./product-card";

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

type CollectionGridProps = {
  /** Kolekcija čija je ovo stranica (id); bez nje svi proizvodi. Kategorija je filter iz `listing.query`. */
  collection?: string;
  /** Otvoreno polje pretrage. */
  search: boolean;
  /** Proizvodi koje je server izabrao za izbor iz adrese, ukupan broj i opcije za filtere. */
  listing: Listing<CardProduct>;
  /** Oznaka valute uz polja za cenu. */
  currency: string;
};

/**
 * Mreža proizvoda sa kategorijama, pretragom, sortiranjem i filterima po ceni i opcijama.
 * Filtere računa server nad celim katalogom (lib/storefront/collection.ts): svaki izbor menja
 * adresu, a stranica stiže sa novim spiskom.
 */
export function CollectionGrid({ collection, search, listing, currency }: CollectionGridProps) {
  const to = usePath();
  const t = useT();
  const router = useRouter();
  const { config } = useCart();
  const { query, items: list, total: n, facets } = listing;
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Polja u koja se kuca imaju svoje stanje; adresa se menja kada kupac zastane.
  const [text, setText] = useState(query.search);
  const [min, setMin] = useState(query.min === null ? "" : String(query.min));
  const [max, setMax] = useState(query.max === null ? "" : String(query.max));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const cat = query.category;
  const rows = categoryRows(config.categories, cat);
  const base = collection ? `/kolekcija/${collection}` : "/kolekcija";
  /** Adresa iste stranice sa drugom kategorijom; ostali filteri ostaju, strana se vraća na prvu. */
  const categoryHref = (category: string) =>
    to(`${base}${((part) => (part ? `?${part}` : ""))(listingSearch({ ...query, category, page: 1 }, search))}`);
  const path = rows.map((row) => row.parent);
  const picked = query.options;
  const shown = list.length;
  const active = (query.min === null ? 0 : 1) + (query.max === null ? 0 : 1) + Object.values(picked).reduce((sum, values) => sum + values.length, 0);

  /** Otvara istu stranicu sa novim izborom, bez pomeranja na vrh. Svaka izmena filtera vraća na prvu stranu. */
  function go(change: Partial<ListingQuery>, delay = 0) {
    const next = { ...query, page: 1, ...change };
    const href = to(`${base}${((part) => (part ? `?${part}` : ""))(listingSearch(next, search))}`);
    if (timer.current) clearTimeout(timer.current);
    const open = () => startTransition(() => router.replace(href, { scroll: false }));
    if (delay > 0) timer.current = setTimeout(open, delay);
    else open();
  }

  const price = (value: string) => (value.trim() !== "" && Number(value) >= 0 ? Number(value) : null);

  function toggle(name: string, value: string) {
    const current = picked[name] ?? [];
    const values = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    const options = { ...picked, [name]: values };
    if (values.length === 0) delete options[name];
    go({ options });
  }

  function clearFilters() {
    setMin("");
    setMax("");
    go({ min: null, max: null, options: {} });
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
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              go({ search: event.target.value.trim() }, 350);
            }}
            style={{ borderRadius: "999px", padding: "14px 24px" }}
          />
        </div>
      )}

      <div className="a3" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "14px 24px" }}>
        {/* Kategorije su filter: link na istu stranicu sa ?kategorija=, pa se izbor može podeliti adresom. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" }}>
          {rows.map((row, level) => (
            <nav className="seg" aria-label={level === 0 ? t("Kategorije") : t("Podkategorije")} key={row.parent}>
              {level === 0 && (
                <Link className={cat === "" ? "chip on" : "chip"} href={categoryHref("")} scroll={false} replace>
                  {t("Sve")}
                </Link>
              )}
              {row.items.map((c) => (
                <Link
                  className={c.id === cat || path.includes(c.id) ? "chip on" : "chip"}
                  href={categoryHref(c.id)}
                  scroll={false}
                  replace
                  aria-current={c.id === cat ? "true" : undefined}
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
              value={query.sort}
              onChange={(event) => go({ sort: event.target.value as Sort })}
              style={{ width: "auto", minHeight: "48px", padding: "8px 16px", borderRadius: "999px", fontSize: "15px", cursor: "pointer" }}
            >
              <option value="rec">{t("Preporučeno")}</option>
              <option value="asc">{t("Cena: rastuće")}</option>
              <option value="desc">{t("Cena: opadajuće")}</option>
              <option value="az">{t("Naziv: A–Š")}</option>
            </select>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="panel" style={{ display: "flex", flexWrap: "wrap", gap: "22px 40px", alignItems: "flex-start", padding: "22px 26px" }}>
          <div className="f" style={{ gap: "8px" }}>
            <span className="lab">{t("Cena")} ({currency})</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder={t("od")}
                aria-label={t("Cena od")}
                value={min}
                onChange={(event) => { setMin(event.target.value); go({ min: price(event.target.value) }, 500); }}
                style={{ width: "120px", borderRadius: "999px", padding: "10px 18px" }}
              />
              <span className="muted">–</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder={t("do")}
                aria-label={t("Cena do")}
                value={max}
                onChange={(event) => { setMax(event.target.value); go({ max: price(event.target.value) }, 500); }}
                style={{ width: "120px", borderRadius: "999px", padding: "10px 18px" }}
              />
            </div>
          </div>
          {facets.map((facet) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} role="group" aria-label={facet.label} key={facet.name}>
              <span className="lab">{facet.label}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {facet.values.map(({ value, label }) => {
                  const on = (picked[facet.name] ?? []).includes(value);
                  return (
                    <button
                      className={on ? "chip on" : "chip"}
                      aria-pressed={on}
                      onClick={() => toggle(facet.name, value)}
                      style={on ? undefined : { background: "var(--paper)" }}
                      key={value}
                    >
                      {label}
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

      <div className="grid" aria-busy={pending} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", opacity: pending ? 0.55 : 1, transition: "opacity .25s" }}>
        {list.map((p) => (
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
              <button className="btn ghost" type="button" disabled={pending} onClick={() => go({ page: query.page + 1 })} style={{ marginTop: "8px" }}>
                {t("Učitaj još")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
