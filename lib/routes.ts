import type { Lang } from "@/lib/i18n";

/**
 * Adrese stranica prodavnice na jeziku sajta. Rute u kodu imaju srpske („kanonske") adrese;
 * na drugom jeziku se iste stranice otvaraju i na prevedenoj adresi (/collection umesto
 * /kolekcija), a linkovi na sajtu, u emailu i u mapi sajta se ispisuju na jeziku sajta.
 * Prevedenu adresu u kanonsku vraća proxy.ts. Radi i na serveru i u pregledaču.
 */

/** Deo adrese → prevod. Duža adresa stoji pre kraće koja je njen početak. */
const PATHS: [string, Partial<Record<Lang, string>>][] = [
  ["/placanje/proba-kartice", { en: "/checkout/test-card" }],
  ["/placanje/uplata", { en: "/checkout/payment" }],
  ["/placanje", { en: "/checkout" }],
  ["/kolekcija", { en: "/collection" }],
  ["/proizvod", { en: "/product" }],
  ["/nalog/lozinka", { en: "/account/password" }],
  ["/nalog/racun", { en: "/account/invoice" }],
  ["/nalog", { en: "/account" }],
  ["/lista-zelja", { en: "/wishlist" }],
  ["/pracenje", { en: "/tracking" }],
  ["/korpa/vrati", { en: "/cart/restore" }],
  ["/korpa/odjava", { en: "/cart/unsubscribe" }],
  ["/novosti/odjava", { en: "/newsletter/unsubscribe" }],
  // Ista adresa na svim jezicima; ovde je da je stranica iz panela ne zauzme.
  ["/blog", {}],
];

/** Nazivi parametara u adresi (?pretraga=…) i vrednosti koje nisu sadržaj. */
const PARAMS: [string, Partial<Record<Lang, string>>][] = [
  ["pretraga", { en: "search" }],
  ["kategorija", { en: "category" }],
  ["tema", { en: "topic" }],
  ["oznaka", { en: "tag" }],
  ["strana", { en: "page" }],
  ["sortiraj", { en: "sort" }],
  ["cena-od", { en: "price-from" }],
  ["cena-do", { en: "price-to" }],
  ["opcija", { en: "option" }],
  ["broj", { en: "number" }],
  ["porudzbina", { en: "order" }],
  ["ishod", { en: "result" }],
  ["iznos", { en: "amount" }],
  ["potpis", { en: "signature" }],
];
const VALUES: [string, Partial<Record<Lang, string>>][] = [
  ["uspeh", { en: "success" }],
  ["odbijeno", { en: "declined" }],
];

/** Prvi delovi adresa koje pripadaju prodavnici na bilo kom jeziku; stranica iz panela ne može da ih zauzme. */
export const ROUTE_SLUGS = [
  ...new Set(PATHS.flatMap(([path, other]) => [path, ...Object.values(other)]).flatMap((path) => (path ? [path.split("/")[1]] : []))),
];

const starts = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

function swapQuery(query: string, pick: (entry: [string, Partial<Record<Lang, string>>]) => [string, string] | null): string {
  if (!query) return query;
  const names = new Map(PARAMS.map(pick).filter((pair): pair is [string, string] => pair !== null));
  const values = new Map(VALUES.map(pick).filter((pair): pair is [string, string] => pair !== null));
  return query
    .split("&")
    .map((part) => {
      const [name, ...rest] = part.split("=");
      const value = rest.join("=");
      const next = names.get(name);
      if (!next) return part;
      return rest.length === 0 ? next : `${next}=${values.get(value) ?? value}`;
    })
    .join("&");
}

function split(href: string): [string, string, string] {
  const hashAt = href.indexOf("#");
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const rest = hashAt === -1 ? href : href.slice(0, hashAt);
  const queryAt = rest.indexOf("?");
  return queryAt === -1 ? [rest, "", hash] : [rest.slice(0, queryAt), rest.slice(queryAt + 1), hash];
}

/**
 * Adresa na jeziku sajta: `localPath("en", "/kolekcija/fotelje?pretraga=1")` → "/collection/fotelje?search=1".
 * Adrese van sajta (https://…, mailto:, #deo) i adrese stranica iz panela ostaju iste.
 */
export function localPath(lang: Lang, href: string, prefix = ""): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  // Panel, API i fajlovi imaju stalne adrese.
  if (/^\/(admin|api|media|shop|_next)(\/|$)/.test(href)) return href;
  if (lang === "sr") return `${prefix}${href}`.replace(/(.)\/$/, "$1");
  const [path, query, hash] = split(href);
  // Jezik bez sopstvenih adresa koristi engleske.
  const word = (other: Partial<Record<Lang, string>>) => other[lang] ?? other.en;
  const found = PATHS.find(([canonical, other]) => word(other) && starts(path, canonical));
  const local = found ? `${word(found[1])}${path.slice(found[0].length)}` : path;
  const localQuery = swapQuery(query, ([canonical, other]) => (word(other) ? [canonical, word(other) as string] : null));
  const full = `${prefix}${local}`.replace(/(.)\/$/, "$1");
  return `${full}${localQuery ? `?${localQuery}` : ""}${hash}`;
}

/** Početak adrese za jezik koji nije glavni: "/en", "/de"; glavni jezik nema početak. */
export function langPrefix(lang: Lang, main: Lang): string {
  return lang === main ? "" : `/${lang}`;
}

const LANG_PREFIX = /^\/([a-z]{2}(?:-[a-z]{2,4})?)(?=\/|$)/;

/** Jezik sa početka adrese ("/en/collection" → "en" i "/collection"); null kada ga nema. */
export function splitLang(pathname: string): { lang: Lang; pathname: string } | null {
  const match = LANG_PREFIX.exec(pathname);
  if (!match) return null;
  return { lang: match[1], pathname: pathname.slice(match[0].length) || "/" };
}

/** Adresa iste stranice na drugom jeziku, za izbor jezika na sajtu. `pathname` je adresa koju kupac vidi. */
export function switchLang(pathname: string, search: string, from: Lang, to: Lang, main: Lang): string {
  const bare = from === main ? pathname : (splitLang(pathname)?.pathname ?? pathname);
  const canonical = canonicalPath(bare, search);
  const href = canonical ? `${canonical.pathname}${canonical.search}` : `${bare}${search}`;
  return localPath(to, href, langPrefix(to, main));
}

/**
 * Prevedena adresa nazad u adresu rute: "/collection/fotelje" → "/kolekcija/fotelje".
 * Vraća null kada je adresa već kanonska, da proxy ne prepisuje bez potrebe.
 */
export function canonicalPath(pathname: string, search: string): { pathname: string; search: string } | null {
  let path = pathname;
  for (const [canonical, other] of PATHS) {
    const local = Object.values(other).find((candidate) => candidate !== undefined && starts(pathname, candidate));
    if (local) {
      path = `${canonical}${pathname.slice(local.length)}`;
      break;
    }
  }
  const query = search.startsWith("?") ? search.slice(1) : search;
  let canonicalQuery = query;
  for (const lang of ["en"] as Lang[]) {
    canonicalQuery = swapQuery(canonicalQuery, ([canonical, other]) => (other[lang] ? [other[lang], canonical] : null));
  }
  if (path === pathname && canonicalQuery === query) return null;
  return { pathname: path, search: canonicalQuery ? `?${canonicalQuery}` : "" };
}
