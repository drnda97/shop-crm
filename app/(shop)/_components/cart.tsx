"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ShopConfig, ShopProduct } from "@/lib/storefront/products";
import { createStore } from "./store";

/**
 * Šta se čuva u pregledaču: samo koji proizvod, koja varijanta i koliko komada.
 * `variantId` je id varijante kod proizvoda koji ih imaju; `variant` je tekst ispod naziva
 * (naziv varijante, ili kratak opis proizvoda bez varijanti).
 */
type StoredItem = { slug: string; variant: string; variantId?: string; qty: number };

/** Stavka za prikaz: naziv, cena i slika su uvek iz kataloga CRM-a, ne iz pregledača. */
export type CartItem = StoredItem & { name: string; price: number; image: string | null };

/** Stavka se prepoznaje po proizvodu i varijanti: ista fotelja u drugoj tkanini je druga stavka. */
export function cartKey(item: { slug: string; variant: string; variantId?: string }): string {
  return item.slug + (item.variantId ?? item.variant);
}

// Korpa pri prvoj poseti, kao u dizajnu.
const SEED: StoredItem[] = [
  { slug: "okretna-fotelja-mio", variant: "Pesak, Hrast", variantId: "pesak-hrast", qty: 1 },
  { slug: "hoklica-hrast", variant: "Masivni hrast, 65 cm", qty: 1 },
];

const store = createStore<StoredItem[]>("demoshop:cart", SEED, (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item?.slug === "string" && Number.isInteger(item.qty) && item.qty > 0)
    : SEED,
);

type Cart = {
  /** Proizvodi i podešavanja iz CRM-a, učitani u layoutu prodavnice. */
  products: ShopProduct[];
  config: ShopConfig;
  items: CartItem[];
  count: number;
  subtotal: number;
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Dodaje stavku (ili povećava količinu postojeće) i otvara korpu. */
  add: (item: { slug: string; variant: string; variantId?: string; qty?: number }) => void;
  setQty: (key: string, delta: number) => void;
  clear: () => void;
};

const CartContext = createContext<Cart | null>(null);

type CartProviderProps = { products: ShopProduct[]; config: ShopConfig; children: ReactNode };

/** Jedna korpa za sve stranice prodavnice. */
export function CartProvider({ products, config, children }: CartProviderProps) {
  const stored = store.use();
  const pathname = usePathname();
  // Korpa je otvorena samo na stranici na kojoj je otvorena: prelazak na drugu je zatvara.
  const [openOn, setOpenOn] = useState<string | null>(null);

  const openCart = useCallback(() => setOpenOn(pathname), [pathname]);
  const closeCart = useCallback(() => setOpenOn(null), []);

  const add = useCallback<Cart["add"]>(
    (item) => {
      const current = store.read();
      const key = cartKey(item);
      const qty = item.qty || 1;
      const has = current.some((i) => cartKey(i) === key);
      store.write(
        has
          ? current.map((i) => (cartKey(i) === key ? { ...i, qty: i.qty + qty } : i))
          : [...current, { slug: item.slug, variant: item.variant, variantId: item.variantId, qty }],
      );
      setOpenOn(pathname);
    },
    [pathname],
  );

  const setQty = useCallback<Cart["setQty"]>((key, delta) => {
    store.write(
      store
        .read()
        .map((i) => (cartKey(i) === key ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );
  }, []);

  const clear = useCallback(() => store.write([]), []);

  const value = useMemo<Cart>(() => {
    // Proizvod ili varijanta koja je u međuvremenu povučena ili rasprodata ispada iz korpe.
    const items = stored.flatMap((item) => {
      const product = products.find((candidate) => candidate.slug === item.slug);
      if (!product) return [];
      if (product.variants.length === 0) {
        return [{ ...item, variantId: undefined, name: product.name, price: product.price, image: product.image }];
      }
      const variant = product.variants.find((candidate) => candidate.id === item.variantId);
      if (!variant?.available) return [];
      // Naziv i cena varijante su iz kataloga, ne iz onoga što je upisano u pregledaču.
      return [{ ...item, variant: variant.label, name: product.name, price: variant.price, image: variant.image ?? product.image }];
    });
    return {
      products,
      config,
      items,
      count: items.reduce((sum, i) => sum + i.qty, 0),
      subtotal: items.reduce((sum, i) => sum + i.price * i.qty, 0),
      open: openOn === pathname,
      openCart,
      closeCart,
      add,
      setQty,
      clear,
    };
  }, [products, config, stored, openOn, pathname, openCart, closeCart, add, setQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): Cart {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart se koristi unutar CartProvider-a");
  return cart;
}

/** Dostava za dati iznos (posle popusta), prema podešavanjima iz CRM-a. */
export function shippingFor(config: ShopConfig, amount: number) {
  const isFree = config.freeFrom !== null && amount >= config.freeFrom;
  return {
    isFree,
    price: isFree ? 0 : config.shippingPrice,
    /** Koliko još do besplatne dostave, i popunjenost trake u procentima. */
    remaining: config.freeFrom === null ? 0 : Math.max(0, config.freeFrom - amount),
    pct: config.freeFrom ? Math.min(100, Math.round((amount / config.freeFrom) * 100)) + "%" : "0%",
  };
}
