/**
 * Proizvod kako ga vidi javna prodavnica, i sitne funkcije za ispis. Bez pristupa
 * bazi, pa sme i u "use client" komponente; iz CRM-a ga puni lib/storefront/catalog.ts.
 */

import type { ProductHighlight, ProductOption } from "@/lib/catalog";
import type { PaymentMethod } from "@/lib/settings";
import type { ShippingMethod } from "@/lib/shipping";
import type { Templates } from "@/lib/templates";

export type ShopProduct = {
  /** Isto što i slug: po njemu se proizvod prepoznaje u korpi. */
  id: string;
  slug: string;
  name: string;
  /** Naziv glavne kategorije, ili prazno kada proizvod nije ni u jednoj. */
  category: string;
  /** Id glavne kategorije: vodi na njenu stranicu (/kolekcija/{id}). */
  categoryId: string;
  /** Sve kategorije u kojima se proizvod vidi: njegove i njihove nadkategorije (id). */
  categoryIds: string[];
  /** Ručno izabrani slični proizvodi (slug). */
  related: string[];
  seoTitle: string;
  seoDescription: string;
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
  /** Težina u gramima (0 kada nije upisana), za dostavu koja se naplaćuje po težini. */
  weight: number;
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

export type ShopCategory = { id: string; label: string; parent: string };

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
  /** Kategorije iz CRM-a, složene kao stablo (nadkategorija pa njene podkategorije). */
  categories: ShopCategory[];
  /** Oznake za merenje poseta (Podešavanja → Analitika); učitavaju se samo uz pristanak posetioca. */
  analytics: { ga4: string; metaPixel: string };
  /** Kupac koji upiše email na stranici plaćanja, a ne poruči, dobija podsetnik (panel → Napuštene korpe). */
  cartReminder: boolean;
  /** Načini dostave iz CRM-a (Podešavanja → Dostava); cenu za korpu računa lib/shipping.ts. */
  shipping: ShippingMethod[];
  payments: { id: PaymentMethod; label: string }[];
};

/** 39900 → „39.900 RSD". */
export function formatPrice(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " RSD";
}

/** „1 proizvod", „3 proizvoda". */
export function countLabel(count: number): string {
  return count === 1 ? "1 proizvod" : count + " proizvoda";
}
