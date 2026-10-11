/**
 * Proizvod kako ga vidi javna prodavnica, i sitne funkcije za ispis. Bez pristupa
 * bazi, pa sme i u "use client" komponente; iz CRM-a ga puni lib/storefront/catalog.ts.
 */

import type { ProductHighlight, ProductOption } from "@/lib/catalog";
import type { Templates } from "@/lib/templates";

export type ShopProduct = {
  /** Isto što i slug: po njemu se proizvod prepoznaje u korpi. */
  id: string;
  slug: string;
  name: string;
  /** Naziv kategorije, ili prazno kada proizvod nije ni u jednoj. */
  category: string;
  /** Podrazumevana varijanta (kratak opis iz CRM-a): ulazi u korpu kada se proizvod doda sa kartice. */
  variant: string;
  /** Cena koju kupac plaća, u dinarima. */
  price: number;
  /** Cena pre sniženja; upisana samo dok je proizvod na akciji. */
  oldPrice?: number;
  /** Putanja do slike (/media/…), ili null kada je nema. */
  image: string | null;
  /** Oznaka na kartici („Novo", „Bestseler", „−15%"), ili prazno. */
  tag: string;
  /** Opis na stranici proizvoda. */
  description: string;
  attributes: { title: string; text: string }[];
  gallery: string[];
  /** Opcije koje kupac bira; svaka kombinacija vrednosti je jedna varijanta. */
  options: ProductOption[];
  /** Uključene varijante; prazno kod proizvoda bez opcija. Kod proizvoda sa varijantama `price` je najniža cena. */
  variants: ShopVariant[];
  /** Varijante imaju različite cene, pa se cena na kartici ispisuje kao „od". */
  priceFrom: boolean;
  /** Oznaka „pri kraju" proizvoda bez varijanti, ili null; kod varijanti je uz svaku varijantu. */
  lowStock: string | null;
  highlight: ProductHighlight;
  /** Kolekcije u kojima je proizvod (id), za sekciju „Proizvodi". */
  collections: string[];
};

export type ShopVariant = {
  id: string;
  values: string[];
  /** „Grafit, Orah" — tako se varijanta ispisuje u korpi i porudžbini. */
  label: string;
  price: number;
  oldPrice?: number;
  image: string | null;
  /** Može da se poruči: ima cenu i na stanju je. */
  available: boolean;
  /** Najviše komada u jednoj porudžbini. */
  maxQty: number;
  /** Oznaka „pri kraju" („Još samo 2 kom."), ili null. */
  lowStock: string | null;
};

/** Podešavanja iz CRM-a koja prodavnici trebaju u pregledaču. */
export type ShopConfig = {
  storeName: string;
  /** Putanja do logoa (/media/…), ili null: tada se ispisuje naziv prodavnice. */
  logo: string | null;
  menu: { label: string; href: string }[];
  /** Tekstovi i fotografije kolekcije, proizvoda, naloga, plaćanja i korpe (Izgled sajta). */
  texts: Templates;
  /** Filteri u kolekciji i tabovi na početnoj: „Sve", pa kategorije iz CRM-a. */
  categories: string[];
  shippingPrice: number;
  /** Vrednost korpe od koje je dostava besplatna; null kada je isključena. */
  freeFrom: number | null;
  /** Kupac može da izabere preuzimanje u salonu. */
  pickup: boolean;
  payments: { id: "cod" | "bank"; label: string }[];
};

/** 39900 → „39.900 RSD". */
export function formatPrice(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " RSD";
}

/** „1 proizvod", „3 proizvoda". */
export function countLabel(count: number): string {
  return count === 1 ? "1 proizvod" : count + " proizvoda";
}
