/**
 * Katalog: proizvodi, kategorije, kolekcije i stranice. Ovde su tipovi i pravila
 * koja ne zavise od baze, pa ih koriste i panel i API.
 */

import { ROUTE_SLUGS } from "@/lib/routes";
import type { Section } from "@/lib/sections";

export type LowStockMode = "off" | "always" | "auto";

export type Product = {
  slug: string;
  name: string;
  /** Šifra artikla; neobavezna. */
  sku: string;
  /** Glavna kategorija (id), ili prazno kada proizvod nije ni u jednoj; uvek prva u `categories`. */
  category: string;
  /** Sve kategorije proizvoda (id). Proizvod u podkategoriji se vidi i u njenim nadkategorijama. */
  categories: string[];
  /** Naslov i opis za pretraživače; prazno: naziv, odnosno početak opisa proizvoda. */
  seoTitle: string;
  seoDescription: string;
  /** Ručno izabrani slični proizvodi (slug); ostatak se dopunjuje iz iste kategorije. */
  related: string[];
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
  /**
   * Varijante: po jedna za svaku kombinaciju vrednosti opcija (npr. „Grafit, Orah"). Proizvod
   * bez opcija nema varijante. Dok ih ima, cena, šifra i stanje se čitaju iz varijante.
   */
  variants: Variant[];
};

export type Variant = {
  /** Napravljen iz vrednosti opcija (npr. „grafit-orah"); po njemu se varijanta prepoznaje u korpi. */
  id: string;
  /** Vrednost svake opcije, redom kojim su opcije upisane. */
  values: string[];
  /** Sopstvena cena; null: važe cena i akcija proizvoda. */
  price: number | null;
  /** Akcijska cena varijante; gleda se samo uz sopstvenu cenu. */
  salePrice: number | null;
  sku: string;
  /** Broj komada ove varijante; null: broj se ne vodi i važi ručno stanje proizvoda. */
  stockQty: number | null;
  /** Slika varijante: jedna od slika proizvoda. */
  image?: string;
  /** Isključena varijanta se ne nudi kupcu (kombinacija koja se ne pravi). */
  enabled: boolean;
};

/** Najviše varijanti po proizvodu; više kombinacija znači da opcije treba podeliti na više proizvoda. */
export const MAX_VARIANTS = 100;

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


export type Category = {
  id: string;
  label: string;
  /** Id nadkategorije, ili prazno za kategoriju na vrhu. */
  parent: string;
  /** Tekst na vrhu stranice kategorije. */
  description: string;
  /** Naslov i opis za pretraživače; prazno: naziv kategorije, odnosno njen tekst. */
  seoTitle: string;
  seoDescription: string;
};

/** Kategorija i sve njene podkategorije, na bilo kojoj dubini (id). */
export function withDescendants(categories: Category[], id: string): string[] {
  const ids = [id];
  for (let index = 0; index < ids.length; index++) {
    for (const category of categories) {
      if (category.parent === ids[index] && !ids.includes(category.id)) ids.push(category.id);
    }
  }
  return ids;
}

/** Put od vrha do kategorije: „Nameštaj › Stolice › Barske". Prekida se ako zapis ima petlju. */
export function categoryPath(categories: Category[], id: string): Category[] {
  const path: Category[] = [];
  let current = categories.find((category) => category.id === id);
  while (current && !path.includes(current)) {
    path.unshift(current);
    const parent = current.parent;
    current = categories.find((category) => category.id === parent);
  }
  return path;
}

/** Kategorije složene kao stablo: nadkategorija, pa njene podkategorije; `depth` je uvlačenje. */
export function categoryTree(categories: Category[]): { category: Category; depth: number }[] {
  const ids = new Set(categories.map((category) => category.id));
  const walk = (parent: string, depth: number, seen: string[]): { category: Category; depth: number }[] =>
    categories
      // Kategorija čija nadkategorija više ne postoji prikazuje se na vrhu.
      .filter((category) => (ids.has(category.parent) ? category.parent : "") === parent && !seen.includes(category.id))
      .flatMap((category) => [{ category, depth }, ...walk(category.id, depth + 1, [...seen, category.id])]);
  return walk("", 0, []);
}

/** Da li je proizvod u kategoriji ili u nekoj njenoj podkategoriji. */
export function inCategory(product: Product, id: string, categories: Category[]): boolean {
  const ids = withDescendants(categories, id);
  return product.categories.some((category) => ids.includes(category));
}

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
export const RESERVED_SLUGS = ["admin", "api", "media", "nova", "robots.txt", "shop", "sitemap.xml", ...ROUTE_SLUGS];

/** Adresa stranice na sajtu. */
export function pagePath(slug: string): string {
  return slug === HOME_SLUG ? "/" : `/${slug}`;
}

/** Tekst pretvoren u oznaku za adresu: mala slova bez kvačica, cifre i crtice. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/* ---------- Varijante ---------- */

export function variantId(values: string[]): string {
  return values.map((value) => slugify(value) || "x").join("-").slice(0, 120);
}

/** Naziv varijante za kupca i za porudžbinu: „Grafit, Orah". */
export function variantLabel(variant: Variant): string {
  return variant.values.join(", ");
}

export function countCombinations(options: ProductOption[]): number {
  return options.length === 0 ? 0 : options.reduce((count, option) => count * option.values.length, 1);
}

/**
 * Varijante za date opcije: sve kombinacije vrednosti, redom opcija. Kombinacija koja već
 * postoji zadržava svoju cenu, šifru i stanje; nova nastaje bez sopstvene cene i uključena.
 * Preko MAX_VARIANTS kombinacija se ne pravi nijedna (forma to javlja kao grešku).
 */
export function syncVariants(options: ProductOption[], existing: Variant[]): Variant[] {
  const count = countCombinations(options);
  if (count === 0 || count > MAX_VARIANTS) return [];
  let combinations: string[][] = [[]];
  for (const option of options) {
    combinations = combinations.flatMap((values) => option.values.map((value) => [...values, value.label]));
  }
  const taken = new Set<string>();
  return combinations.flatMap((values) => {
    const id = variantId(values);
    // Dve vrednosti koje daju istu oznaku (npr. „Bež" i „Bez") bi bile ista varijanta.
    if (taken.has(id)) return [];
    taken.add(id);
    const old = existing.find((variant) => variant.id === id);
    return [{ price: null, salePrice: null, sku: "", stockQty: null, enabled: true, ...old, id, values }];
  });
}

export function findVariant(product: Product, id: string | undefined): Variant | undefined {
  return product.variants.find((variant) => variant.id === id);
}

/** Redovna i akcijska cena onoga što kupac kupuje: iz varijante ako ima svoju cenu, inače iz proizvoda. */
function offer(product: Product, variant?: Variant): { price: number | null; salePrice: number | null } {
  const source = variant && variant.price !== null ? variant : product;
  return { price: source.price, salePrice: source.salePrice };
}

export function isOnSale(product: Product, variant?: Variant): boolean {
  const { price, salePrice } = offer(product, variant);
  return price !== null && salePrice !== null && salePrice < price;
}

/** Redovna cena, pre akcije. */
export function regularPrice(product: Product, variant?: Variant): number | null {
  return offer(product, variant).price;
}

/** Cena koju kupac plaća: akcijska dok akcija važi, inače redovna. */
export function currentPrice(product: Product, variant?: Variant): number | null {
  const { price, salePrice } = offer(product, variant);
  return isOnSale(product, variant) ? salePrice : price;
}

/** Varijante koje kupac može da poruči: uključene, sa cenom i na stanju. */
export function orderableVariants(product: Product): Variant[] {
  return product.variants.filter(
    (variant) => variant.enabled && currentPrice(product, variant) !== null && hasStock(product, variant),
  );
}

/** Najniža cena među varijantama koje mogu da se poruče, i da li se cene razlikuju („od 12.000"). */
export function priceRange(product: Product): { from: number | null; varies: boolean } {
  if (product.variants.length === 0) return { from: currentPrice(product), varies: false };
  const prices = orderableVariants(product).map((variant) => currentPrice(product, variant) as number);
  if (prices.length === 0) return { from: currentPrice(product), varies: false };
  return { from: Math.min(...prices), varies: new Set(prices).size > 1 };
}

export function salePercent(product: Product, variant?: Variant): number | null {
  if (!isOnSale(product, variant)) return null;
  const { price, salePrice } = offer(product, variant);
  return Math.round((1 - (salePrice as number) / (price as number)) * 100);
}

/**
 * Ima li ga na stanju: po broju komada ako se vodi, inače po ručnom stanju proizvoda.
 * Za varijantu se gleda njen broj komada; broj upisan uz proizvod tada ne važi.
 */
export function hasStock(product: Product, variant?: Variant): boolean {
  const qty = variant ? variant.stockQty : product.stockQty;
  return qty !== null ? qty > 0 : product.inStock;
}

/** Može li proizvod da se poruči: objavljen, sa cenom i na stanju — kod varijanti, bar u jednoj. */
export function isAvailable(product: Product): boolean {
  if (!product.active) return false;
  if (product.variants.length > 0) return orderableVariants(product).length > 0;
  return product.price !== null && hasStock(product);
}

/** Može li baš ova varijanta da se poruči. */
export function isVariantAvailable(product: Product, variant: Variant): boolean {
  return product.active && orderableVariants(product).includes(variant);
}

/** Koliko komada najviše može u jednu porudžbinu; null kada se broj ne vodi. */
export function stockLimit(product: Product, variant?: Variant): number | null {
  return variant ? variant.stockQty : product.stockQty;
}

/**
 * Tekst oznake „pri kraju" za kupca, ili null kada se ne prikazuje. Kod proizvoda sa
 * varijantama oznaka pripada varijanti (njenom broju komada); režim i prag su zajednički.
 */
export function lowStockLabel(product: Product, variant?: Variant): string | null {
  if (product.variants.length > 0 && !variant) return null;
  if (!hasStock(product, variant)) return null;
  const qty = stockLimit(product, variant);
  const show =
    product.lowStockMode === "always" ||
    (product.lowStockMode === "auto" && qty !== null && qty <= (product.lowStockThreshold ?? 0));
  if (!show) return null;
  if (qty === null) return "Pri kraju";
  return qty === 1 ? "Još samo 1 komad" : `Još samo ${qty} kom.`;
}

/** Ono čemu se vodi stanje: sam proizvod, ili svaka njegova uključena varijanta. */
export type StockUnit = { name: string; variant?: Variant; qty: number | null; inStock: boolean };

export function stockUnits(product: Product): StockUnit[] {
  if (product.variants.length === 0) {
    return [{ name: product.name, qty: product.stockQty, inStock: hasStock(product) }];
  }
  return product.variants
    .filter((variant) => variant.enabled)
    .map((variant) => ({
      name: `${product.name} — ${variantLabel(variant)}`,
      variant,
      qty: variant.stockQty,
      inStock: hasStock(product, variant),
    }));
}

/** Rasprodat: ni proizvod ni ijedna njegova varijanta nije na stanju. */
export function isSoldOut(product: Product): boolean {
  return !stockUnits(product).some((unit) => unit.inStock);
}

/** Varijante koje su rasprodate dok proizvod još može da se kupi u drugoj varijanti. */
export function soldOutVariants(product: Product): StockUnit[] {
  if (isSoldOut(product)) return [];
  return stockUnits(product).filter((unit) => unit.variant && !unit.inStock);
}

/** Pri kraju: na stanju, vodi se broj komada i pao je na prag proizvoda. */
export function lowStockUnits(product: Product): StockUnit[] {
  const threshold = product.lowStockThreshold;
  if (threshold === null) return [];
  return stockUnits(product).filter(
    (unit) => unit.inStock && unit.qty !== null && unit.qty <= threshold,
  );
}

/** Ima li proizvod cenu po kojoj može da se proda: svoju, ili bar na jednoj varijanti. */
export function hasPrice(product: Product): boolean {
  return product.price !== null || product.variants.some((variant) => variant.enabled && variant.price !== null);
}

/** Proizvodi kolekcije, redom kojim su u njoj; obrisani proizvodi se preskaču. */
export function getCollectionProducts(collection: Collection, products: Product[]): Product[] {
  return collection.productSlugs.flatMap((slug) => {
    const product = products.find((candidate) => candidate.slug === slug);
    return product ? [product] : [];
  });
}
