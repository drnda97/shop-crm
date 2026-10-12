"use client";

import { usePath } from "@/lib/i18n/client";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useCart } from "./cart";
import { ProductCard } from "./product-card";
import { createStore } from "./store";

/**
 * Lista želja: proizvodi koje je kupac sačuvao. Čuva se u pregledaču, kao i korpa, pa radi i
 * bez naloga; na drugom uređaju je prazna.
 */
const store = createStore<string[]>("shop:wishlist", [], (value) =>
  Array.isArray(value) ? value.filter((slug) => typeof slug === "string").slice(0, 200) : [],
);

export function useWishlist() {
  const slugs = store.use();
  return {
    slugs,
    has: (slug: string) => slugs.includes(slug),
    toggle: (slug: string) => store.write(slugs.includes(slug) ? slugs.filter((item) => item !== slug) : [...slugs, slug]),
  };
}

/** Srce na kartici i na stranici proizvoda. */
export function WishButton({ slug, name, floating = false }: { slug: string; name: string; floating?: boolean }) {
  const t = useT();
  const { has, toggle } = useWishlist();
  const on = has(slug);
  return (
    <button
      type="button"
      className={floating ? "wish float" : "wish"}
      aria-pressed={on}
      aria-label={on ? t("Ukloni iz liste želja: {naziv}", { naziv: name }) : t("Dodaj u listu želja: {naziv}", { naziv: name })}
      onClick={(event) => {
        // Na kartici je dugme preko linka ka proizvodu.
        event.preventDefault();
        toggle(slug);
      }}
    >
      <svg width="20" height="18" viewBox="0 0 20 18" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.600" strokeLinejoin="round">
        <path d="M10 16.500S1.500 11.700 1.500 6.200A4.200 4.200 0 0110 4.300a4.200 4.200 0 018.500 1.900C18.500 11.700 10 16.500 10 16.500z"></path>
      </svg>
    </button>
  );
}

/** Stranica /lista-zelja: sačuvani proizvodi koji su još u ponudi. */
export function WishlistGrid() {
  const to = usePath();
  const t = useT();
  const { products } = useCart();
  const { slugs } = useWishlist();
  const list = slugs.flatMap((slug) => products.filter((product) => product.slug === slug));
  if (list.length === 0) {
    return (
      <>
        <p className="lead">{t("Još niste sačuvali nijedan proizvod. Srce na kartici proizvoda ga dodaje ovde.")}</p>
        <Link className="btn" href={to("/kolekcija")}>{t("Pogledajte kolekciju")}</Link>
      </>
    );
  }
  return (
    <div className="grid" style={{ width: "100%", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))" }}>
      {list.map((product) => (
        <ProductCard product={product} key={product.id} />
      ))}
    </div>
  );
}
