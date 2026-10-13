
import type { ListingSort } from "@/lib/listing";

/**
 * Spisak proizvoda na stranici kolekcije: filtere, pretragu, redosled i strane računa baza
 * (lib/listing.ts), a server i pregledač dobijaju samo proizvode koji se prikazuju. Izbor kupca je
 * u adresi (?pretraga=, ?cena-od=, ?cena-do=, ?opcija=Boja:Pesak, ?sortiraj=, ?strana=), pa se
 * filtrirana stranica može podeliti linkom.
 */

/** Redosled: preporučeno (kako je složeno u panelu), cena rastuće, cena opadajuće, naziv. Iste oznake na svim jezicima. */
export const SORTS = ["rec", "asc", "desc", "az"] as const satisfies readonly ListingSort[];
export type Sort = ListingSort;

/** Koliko proizvoda donosi jedna strana („Učitaj još" dodaje sledeću). */
export const PAGE_SIZE = 12;
const MAX_PAGES = 500;

export type ListingQuery = {
  search: string;
  /** Cena u valuti prodavnice, kako je kupac upisuje; null: bez granice. */
  min: number | null;
  max: number | null;
  /** Izabrane vrednosti po opciji: proizvod prolazi ako za svaku opciju ima bar jednu od izabranih. */
  options: Record<string, string[]>;
  sort: Sort;
  page: number;
};

/** Opcija za filter: `name` i `value` idu u adresu (na glavnom jeziku), `label` vidi kupac. */
export type Facet = { name: string; label: string; values: { value: string; label: string }[] };

export type Listing<Product> = {
  query: ListingQuery;
  /** Proizvodi do kraja tražene strane. */
  items: Product[];
  /** Koliko proizvoda prolazi filtere. */
  total: number;
  /** Opcije po kojima se može filtrirati, iz svih proizvoda kategorije. */
  facets: Facet[];
};

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

function amount(value: string): number | null {
  const number = Number(value.replace(",", "."));
  return value.trim() !== "" && Number.isFinite(number) && number >= 0 ? number : null;
}

export function parseListingQuery(params: Params): ListingQuery {
  const options: Record<string, string[]> = {};
  for (const entry of [params.opcija].flat()) {
    const at = entry?.indexOf(":") ?? -1;
    if (!entry || at <= 0) continue;
    const name = entry.slice(0, at).slice(0, 100);
    const value = entry.slice(at + 1).slice(0, 100);
    if (value && !(options[name] ??= []).includes(value) && options[name].length < 30) options[name].push(value);
  }
  return {
    search: first(params.pretraga).trim().slice(0, 100),
    min: amount(first(params["cena-od"])),
    max: amount(first(params["cena-do"])),
    options,
    sort: SORTS.find((sort) => sort === first(params.sortiraj)) ?? "rec",
    page: Math.min(Math.max(Math.trunc(Number(first(params.strana))) || 1, 1), MAX_PAGES),
  };
}

/** Deo adrese posle upitnika za dati izbor; prazno kada je sve podrazumevano. `keepSearch` čuva otvoreno polje pretrage. */
export function listingSearch(query: ListingQuery, keepSearch = false): string {
  const parts: string[] = [];
  if (query.search) parts.push(`pretraga=${encodeURIComponent(query.search)}`);
  else if (keepSearch) parts.push("pretraga");
  if (query.min !== null) parts.push(`cena-od=${query.min}`);
  if (query.max !== null) parts.push(`cena-do=${query.max}`);
  for (const [name, values] of Object.entries(query.options)) {
    for (const value of values) parts.push(`opcija=${encodeURIComponent(`${name}:${value}`)}`);
  }
  if (query.sort !== "rec") parts.push(`sortiraj=${query.sort}`);
  if (query.page > 1) parts.push(`strana=${query.page}`);
  return parts.join("&");
}
