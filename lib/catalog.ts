/**
 * Katalog: proizvodi, kategorije, kolekcije i stranice. Ovde su tipovi i pravila
 * koja ne zavise od baze, pa ih koriste i panel i API.
 */

import type { Section } from "@/lib/sections";

export type LowStockMode = "off" | "always" | "auto";

export type Product = {
  slug: string;
  name: string;
  /** Šifra artikla; neobavezna. */
  sku: string;
  /** Id kategorije, ili prazno kada proizvod nije ni u jednoj. */
  category: string;
  /** Nacrt (false) se ne vidi u API-ju i ne može da se poruči. */
  active: boolean;
  /** Kratak opis, za karticu proizvoda. */
  summary: string;
  description: string;
  /** Dodatne sekcije stranice proizvoda: sastav, dimenzije, održavanje… */
  attributes: { title: string; text: string }[];
  /** Cena u najmanjim jedinicama valute; null: još nije upisana, pa proizvod ne može da se poruči. */
  price: number | null;
  /** Cena na akciji. Važi dok je upisana i niža od redovne. */
  salePrice: number | null;
  /** Težina u gramima; koristi se za popuste po težini. */
  weight: number | null;
  /** Ručno stanje: važi dok se ne vodi broj komada (`stockQty`). */
  inStock: boolean;
  /** Broj komada na stanju; smanjuje se sam pri svakoj porudžbini. null: broj se ne vodi. */
  stockQty: number | null;
  /** Oznaka „pri kraju": isključena, uvek prikazana, ili sama kada broj padne na prag. */
  lowStockMode: LowStockMode;
  lowStockThreshold: number | null;
  /** Putanja do glavne slike (/media/…). */
  image?: string;
  /** Dodatne slike, redom kojim su dodate. */
  gallery: string[];
  /**
   * Opcije koje kupac bira (tkanina, veličina…). Izbor ide u porudžbinu uz naziv proizvoda;
   * cena i stanje su isti za sve opcije.
   */
  options: ProductOption[];
  /** Istaknuti deo stranice proizvoda: tamna traka sa naslovom, tekstom, merama i slikom. */
  highlight: ProductHighlight;
};

export type ProductOption = {
  name: string;
  /** `color` (#rrggbb) pretvara vrednost u kružić u toj boji. */
  values: { label: string; color?: string }[];
};

export type ProductHighlight = {
  heading: string;
  text: string;
  /** Mere i druge kratke činjenice, npr. „Širina" → „72 cm". */
  specs: { label: string; value: string }[];
  image?: string;
};

export const emptyHighlight: ProductHighlight = { heading: "", text: "", specs: [] };

/** Redovi oblika „Naziv: vrednost"; red bez dvotačke je samo naziv. */
export function parsePairs(text: string): [string, string][] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(":");
      return colon === -1
        ? [line, ""]
        : [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
    });
}

/**
 * Opcije iz forme proizvoda: jedan red po opciji, vrednosti razdvojene zarezom, uz vrednost
 * po želji boja — „Tkanina: Pesak #B9AB98, Grafit #3C4346".
 */
export function parseOptions(text: string): ProductOption[] {
  return parsePairs(text)
    .map(([name, list]) => ({
      name: name.slice(0, 60),
      values: list
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 24)
        .map((item) => {
          const color = item.match(/\s(#[0-9a-f]{6})$/i)?.[1];
          const label = (color ? item.slice(0, -color.length) : item).trim().slice(0, 60);
          return color ? { label, color: color.toLowerCase() } : { label };
        })
        .filter((value) => value.label),
    }))
    .filter((option) => option.name && option.values.length > 0)
    .slice(0, 6);
}

export function formatOptions(options: ProductOption[]): string {
  return options
    .map(
      (option) =>
        `${option.name}: ${option.values.map((value) => (value.color ? `${value.label} ${value.color}` : value.label)).join(", ")}`,
    )
    .join("\n");
}


export type Category = { id: string; label: string };

/** Ručno složena grupa proizvoda, npr. „Izdvojeno" ili „Za poklon". */
export type Collection = { id: string; name: string; description: string; productSlugs: string[] };

/** Stranica sajta, složena od sekcija. Na sajtu je na adresi /{slug}; početna je HOME_SLUG. */
export type Page = {
  slug: string;
  title: string;
  sections: Section[];
  /** Naslov i opis za pretraživače; prazno: naslov stranice, odnosno opis prodavnice. */
  seoTitle: string;
  seoDescription: string;
  /** Nacrt (false) se na sajtu ne vidi. */
  published: boolean;
  /** API je vraća u spisku „footerPages". */
  showInFooter: boolean;
};

export const HOME_SLUG = "pocetna";

/** Adrese koje već pripadaju prodavnici i panelu, pa stranica ne može da ih zauzme. */
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "kolekcija",
  "media",
  "nalog",
  "nova",
  "placanje",
  "proizvod",
  "robots.txt",
  "shop",
  "sitemap.xml",
];

/** Adresa stranice na sajtu. */
export function pagePath(slug: string): string {
  return slug === HOME_SLUG ? "/" : `/${slug}`;
}

export function isOnSale(product: Product): boolean {
  return product.price !== null && product.salePrice !== null && product.salePrice < product.price;
}

/** Cena koju kupac plaća: akcijska dok akcija važi, inače redovna. */
export function currentPrice(product: Product): number | null {
  return isOnSale(product) ? product.salePrice : product.price;
}

export function salePercent(product: Product): number | null {
  if (!isOnSale(product)) return null;
  return Math.round((1 - (product.salePrice as number) / (product.price as number)) * 100);
}

/** Ima li ga na stanju: po broju komada ako se vodi, inače po ručnom stanju. */
export function hasStock(product: Product): boolean {
  return product.stockQty !== null ? product.stockQty > 0 : product.inStock;
}

/** Može li proizvod da se poruči: objavljen, sa cenom i na stanju. */
export function isAvailable(product: Product): boolean {
  return product.active && product.price !== null && hasStock(product);
}

/** Koliko komada najviše može u jednu porudžbinu; null kada se broj ne vodi. */
export function stockLimit(product: Product): number | null {
  return product.stockQty;
}

/** Tekst oznake „pri kraju" za kupca, ili null kada se ne prikazuje. */
export function lowStockLabel(product: Product): string | null {
  if (!hasStock(product)) return null;
  const qty = product.stockQty;
  const show =
    product.lowStockMode === "always" ||
    (product.lowStockMode === "auto" && qty !== null && qty <= (product.lowStockThreshold ?? 0));
  if (!show) return null;
  if (qty === null) return "Pri kraju";
  return qty === 1 ? "Još samo 1 komad" : `Još samo ${qty} kom.`;
}

/** Proizvodi kolekcije, redom kojim su u njoj; obrisani proizvodi se preskaču. */
export function getCollectionProducts(collection: Collection, products: Product[]): Product[] {
  return collection.productSlugs.flatMap((slug) => {
    const product = products.find((candidate) => candidate.slug === slug);
    return product ? [product] : [];
  });
}
