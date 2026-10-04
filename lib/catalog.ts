/**
 * Katalog: proizvodi, kategorije, kolekcije i stranice. Ovde su tipovi i pravila
 * koja ne zavise od baze, pa ih koriste i panel i API.
 */

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
};

export type Category = { id: string; label: string };

/** Ručno složena grupa proizvoda, npr. „Izdvojeno" ili „Za poklon". */
export type Collection = { id: string; name: string; description: string; productSlugs: string[] };

/** Stranica sa tekstom i fotografijama; sajt je čita preko API-ja po `slug`-u. */
export type Page = {
  slug: string;
  title: string;
  /** Običan tekst; prazan red razdvaja pasuse. */
  body: string;
  showInFooter: boolean;
  images: { id: string; src: string; alt: string }[];
};

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
