"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cartProductsAction } from "@/app/(shop)/actions";
import { methodPrice, type ShippingMethod } from "@/lib/shipping";
import type { CardProduct, ShopConfig } from "@/lib/storefront/products";
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

// Korpa novog posetioca je prazna.
const SEED: StoredItem[] = [];

const store = createStore<StoredItem[]>("demoshop:cart", SEED, (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item?.slug === "string" && Number.isInteger(item.qty) && item.qty > 0)
    : SEED,
);

type Cart = {
  /** Predlog do besplatne dostave (proizvod bez varijanti), ili null. */
  upsell: CardProduct | null;
  config: ShopConfig;
  items: CartItem[];
  count: number;
  subtotal: number;
  /** Težina korpe u gramima, za dostavu koja se naplaćuje po težini. */
  weight: number;
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Dodaje stavku (ili povećava količinu postojeće) i otvara korpu. */
  /** `product` je proizvod sa kartice ili stranice sa koje se dodaje, da se u korpi vidi odmah. */
  add: (item: { slug: string; variant: string; variantId?: string; qty?: number; product?: CardProduct }) => void;
  setQty: (key: string, delta: number) => void;
  clear: () => void;
  /** Zamenjuje korpu sačuvanom (link iz podsetnika). */
  restore: (items: { slug: string; variantId?: string; qty: number }[]) => Promise<void>;
};

const CartContext = createContext<Cart | null>(null);

type CartProviderProps = { upsell: CardProduct | null; config: ShopConfig; children: ReactNode };

/** Jedna korpa za sve stranice prodavnice. */
export function CartProvider({ upsell, config, children }: CartProviderProps) {
  const stored = store.use();
  // Proizvodi iz korpe, učitani sa servera po potrebi: u pregledač ne stiže ceo katalog.
  // null: proizvod je tražen, ali više nije u ponudi.
  const [known, setKnown] = useState<Record<string, CardProduct | null>>(() => (upsell ? { [upsell.slug]: upsell } : {}));

  useEffect(() => {
    const missing = [...new Set(stored.map((item) => item.slug))].filter((slug) => !(slug in known));
    if (missing.length === 0) return;
    let cancelled = false;
    cartProductsAction(missing)
      .then((found) => {
        if (cancelled) return;
        setKnown((current) => ({
          ...current,
          ...Object.fromEntries(missing.map((slug) => [slug, null])),
          ...Object.fromEntries(found.map((product) => [product.slug, product])),
        }));
      })
      // Bez veze sa serverom korpa ostaje sačuvana; proizvodi se traže ponovo pri sledećoj izmeni.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stored, known]);
  const pathname = usePathname();
  // Korpa je otvorena samo na stranici na kojoj je otvorena: prelazak na drugu je zatvara.
  const [openOn, setOpenOn] = useState<string | null>(null);

  const openCart = useCallback(() => setOpenOn(pathname), [pathname]);
  const closeCart = useCallback(() => setOpenOn(null), []);

  const add = useCallback<Cart["add"]>(
    (item) => {
      const { product } = item;
      if (product) setKnown((current) => ({ ...current, [product.slug]: product }));
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

  const restore = useCallback<Cart["restore"]>(async (items) => {
    const found = await cartProductsAction(items.map((item) => item.slug));
    setKnown((current) => ({ ...current, ...Object.fromEntries(found.map((product) => [product.slug, product])) }));
    store.write(
      items.flatMap((item) => {
        const product = found.find((candidate) => candidate.slug === item.slug);
        return product ? [{ slug: item.slug, variant: product.variant, variantId: item.variantId, qty: item.qty }] : [];
      }),
    );
  }, []);

  const value = useMemo<Cart>(() => {
    // Proizvod ili varijanta koja je u međuvremenu povučena ili rasprodata ispada iz korpe.
    const items = stored.flatMap((item) => {
      const product = known[item.slug];
      if (!product) return [];
      if (product.variants.length === 0) {
        return [{ ...item, variantId: undefined, name: product.name, price: product.price, image: product.image }];
      }
      const variant = product.variants.find((candidate) => candidate.id === item.variantId);
      if (!variant?.available) return [];
      // Naziv i cena varijante su iz kataloga, ne iz onoga što je upisano u pregledaču.
      return [{ ...item, variant: variant.label, name: product.name, price: variant.price, image: variant.image ?? product.image }];
    });
    // Dok proizvodi iz korpe stižu sa servera, broj u zaglavlju je onaj koji je sačuvan u pregledaču.
    const loaded = stored.every((item) => item.slug in known);
    return {
      upsell,
      config,
      items,
      count: (loaded ? items : stored).reduce((sum, i) => sum + i.qty, 0),
      subtotal: items.reduce((sum, i) => sum + i.price * i.qty, 0),
      weight: items.reduce((sum, i) => sum + (known[i.slug]?.weight ?? 0) * i.qty, 0),
      open: openOn === pathname,
      openCart,
      closeCart,
      add,
      setQty,
      clear,
      restore,
    };
  }, [upsell, known, config, stored, openOn, pathname, openCart, closeCart, add, setQty, clear, restore]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): Cart {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart se koristi unutar CartProvider-a");
  return cart;
}

/**
 * Dostava izabranim načinom za dati iznos (posle popusta) i težinu korpe, i koliko još
 * nedostaje do besplatne dostave tim načinom.
 */
export function shippingFor(method: ShippingMethod | undefined, amount: number, weight: number) {
  const freeFrom = method?.freeFrom ?? null;
  const price = method ? methodPrice(method, amount, weight) : 0;
  return {
    freeFrom,
    isFree: price === 0,
    price,
    /** Koliko još do besplatne dostave, i popunjenost trake u procentima. */
    remaining: freeFrom === null ? 0 : Math.max(0, freeFrom - amount),
    pct: freeFrom ? Math.min(100, Math.round((amount / freeFrom) * 100)) + "%" : "0%",
  };
}

/** Način dostave koji se podrazumeva dok kupac ne izabere: prva dostava na adresu. */
export function defaultMethod(config: ShopConfig): ShippingMethod | undefined {
  return config.shipping.find((method) => method.kind === "delivery") ?? config.shipping[0];
}
