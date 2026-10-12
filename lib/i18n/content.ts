import { HOME_SLUG, RESERVED_SLUGS, type Page } from "@/lib/catalog";
import type { Dict, Lang } from "@/lib/i18n";
import { contentPages } from "@/lib/i18n/content-en-pages";
import { panelCore } from "@/lib/i18n/panel-en-core";
import { panelExtra } from "@/lib/i18n/panel-en-extra";
import { shopDict } from "@/lib/i18n/shop";
import type { Settings } from "@/lib/settings";
import { en as themeEn } from "@theme/i18n/en";

/**
 * Početni sadržaj na jeziku sajta. Sadržaj (meni, podnožje, stranice, tekstovi stalnih
 * stranica, email poruke, načini dostave) nastaje na srpskom; kada se jezik sajta promeni,
 * svaki tekst koji je i dalje jednak početnom zamenjuje se prevodom, a početne stranice
 * dobijaju adresu na tom jeziku. Tekst koji je vlasnik izmenio ostaje kako ga je napisao.
 */

/** Tekstovi početnog sadržaja kojih nema u ostalim rečnicima. */
const extra: Dict = {
  "Početna": "Home",
  "Moja prodavnica": "My shop",
  "Dostava na adresu": "Delivery to address",
  "Lično preuzimanje": "Pickup in person",
  "Naziv, kategorija ili tkanina": "Name, category or fabric",
  "Završite porudžbinu": "Complete your order",
  "Sedenje": "Seating",
  "Pitanja": "Questions",
  "Plaćanje": "Payment",
  "Održavanje": "Care",
  "Garancija": "Warranty",
  "Uzorci": "Samples",
  "Isporuka": "Shipping",
  "5 godina garancije, povrat u roku od 30 dana": "5-year warranty, returns within 30 days",
};

const english: Dict = { ...themeEn, ...shopDict.en, ...panelExtra, ...panelCore, ...contentPages, ...extra };

/** Adrese početnih stranica po jezicima; srpska je ona sa kojom stranica nastaje. */
const PAGE_SLUGS: Record<string, Partial<Record<Lang, string>>> = {
  "o-nama": { en: "about" },
  pitanja: { en: "faq" },
  kontakt: { en: "contact" },
  "uslovi-kupovine": { en: "terms" },
  "povrat-i-reklamacije": { en: "returns" },
  privatnost: { en: "privacy" },
};

/** Rečnik početnog sadržaja iz koda, od jezika `from` ka jeziku `to`; prazan kada ga za taj par nema. */
export function contentMap(from: Lang, to: Lang): Map<string, string> {
  return wordMap(from, to);
}

function wordMap(from: Lang, to: Lang): Map<string, string> {
  const pairs = Object.entries(english).filter(([key]) => !/\{\w+\}/.test(key) || key.includes("{broj}") || key.includes("{ime}"));
  if (from === "sr" && to === "en") return new Map(pairs);
  if (from === "en" && to === "sr") {
    const back = new Map<string, string>();
    // Više srpskih tekstova može imati isti prevod; nazad se vraća prvi.
    for (const [serbian, translated] of pairs) if (!back.has(translated)) back.set(translated, serbian);
    return back;
  }
  return new Map();
}

function slugMap(from: Lang, to: Lang): Map<string, string> {
  const name = (slug: string, lang: Lang) => (lang === "sr" ? slug : PAGE_SLUGS[slug][lang]);
  return new Map(Object.keys(PAGE_SLUGS).flatMap((slug) => {
    const a = name(slug, from), b = name(slug, to);
    return a && b && a !== b ? [[a, b] as [string, string]] : [];
  }));
}

/** Menja deo adrese koji je oznaka stranice (/o-nama#proces → /about#proces) i vrednost ?tema=. */
function swapHref(href: string, slugs: Map<string, string>, words: Map<string, string>): string {
  const match = /^\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(href);
  if (!match) return href;
  const [, first, rest, query = "", hash = ""] = match;
  const slug = slugs.get(first) ?? first;
  const nextQuery = query.replace(/([?&]tema=)([^&]*)/, (whole, name: string, value: string) => {
    const translated = words.get(decodeURIComponent(value));
    return translated ? `${name}${encodeURIComponent(translated)}` : whole;
  });
  return `/${slug}${rest}${nextQuery}${hash}`;
}

type Swap = (value: string, key: string) => string;

function walk(value: unknown, swap: Swap, key = ""): unknown {
  if (typeof value === "string") return swap(value, key);
  if (Array.isArray(value)) return value.map((item) => walk(item, swap, key));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, walk(item, swap, name)]));
  }
  return value;
}

type Site = { pages: Page[]; settings: Settings };

/**
 * Preimenuje stranicu i ispravlja linkove ka njoj u meniju, podnožju, sekcijama i tekstovima
 * stalnih stranica. Vraća false kada je nova adresa zauzeta ili nije dozvoljena.
 */
export function renamePage(content: Site, from: string, to: string): boolean {
  if (from === to) return true;
  if (from === HOME_SLUG || RESERVED_SLUGS.includes(to) || content.pages.some((page) => page.slug === to)) return false;
  const page = content.pages.find((candidate) => candidate.slug === from);
  if (!page) return false;
  relink(content, new Map([[from, to]]), new Map());
  page.slug = to;
  return true;
}

function relink(content: Site, slugs: Map<string, string>, words: Map<string, string>) {
  const swap: Swap = (value, key) => {
    // Slike i šifre boja nisu tekst.
    if (key === "src" || key === "position" || /^#[0-9a-f]{6}$/i.test(value)) return value;
    if (value.startsWith("/")) return swapHref(value, slugs, words);
    return words.get(value) ?? value;
  };
  const { settings } = content;
  settings.site = walk(settings.site, swap) as Settings["site"];
  settings.templates = walk(settings.templates, swap) as Settings["templates"];
  settings.abandoned = { ...settings.abandoned, subject: swap(settings.abandoned.subject, ""), text: swap(settings.abandoned.text, "") };
  settings.mail = { ...settings.mail, statusEmails: walk(settings.mail.statusEmails, swap) as Settings["mail"]["statusEmails"] };
  settings.shipping = {
    methods: settings.shipping.methods.map((method) => ({
      ...method,
      name: swap(method.name, ""),
      hint: swap(method.hint, ""),
      confirmation: swap(method.confirmation, ""),
    })),
  };
  settings.store = { ...settings.store, name: swap(settings.store.name, "") };
  for (const page of content.pages) {
    page.title = swap(page.title, "");
    page.seoTitle = swap(page.seoTitle, "");
    page.seoDescription = swap(page.seoDescription, "");
    page.sections = page.sections.map((section) => ({ ...section, data: walk(section.data, swap) as typeof section.data }));
  }
}

/**
 * Prevodi početni sadržaj sa jezika `from` na jezik `to`: tekstove koji su i dalje jednaki
 * početnim, i adrese početnih stranica (sa linkovima ka njima). Menja `content` na mestu.
 */
export function translateContent(content: Site, from: Lang, to: Lang) {
  if (from === to) return;
  const words = wordMap(from, to);
  const slugs = slugMap(from, to);
  // Adresa se menja samo ako nova nije zauzeta drugom stranicom.
  for (const [current, next] of [...slugs]) {
    const page = content.pages.find((candidate) => candidate.slug === current);
    if (!page || content.pages.some((candidate) => candidate.slug === next) || RESERVED_SLUGS.includes(next)) slugs.delete(current);
  }
  relink(content, slugs, words);
  for (const page of content.pages) page.slug = slugs.get(page.slug) ?? page.slug;
}
