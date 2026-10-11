import { normalizeData, type Field } from "@/lib/sections";
import { colorLabels, defaultColors, FONTS, type ThemeColors } from "@/lib/theme";

/**
 * Delovi sajta koji su isti na svakoj stranici: meni, podnožje, traka sa obaveštenjem.
 * Menjaju se u panelu (Izgled sajta), a čuvaju uz ostala podešavanja.
 * Polja su opisana isto kao polja sekcija, pa ih panel uređuje istom formom.
 */

export type MenuLink = { label: string; href: string };

export type SiteSettings = {
  /** Traka na vrhu svake stranice; prazno: nema je. */
  announcement: string;
  announcementHref: string;
  menu: MenuLink[];
  /** Kratak opis prodavnice u podnožju; služi i kao opis za pretraživače kada stranica nema svoj. */
  tagline: string;
  footerColumns: { title: string; links: MenuLink[] }[];
  /** Red pri dnu podnožja, npr. načini plaćanja. */
  footerNote: string;
  legalLinks: MenuLink[];
};

const link: Field[] = [
  { key: "label", label: "Tekst", kind: "text" },
  { key: "href", label: "Adresa", kind: "link" },
];

export const SITE_FIELDS: Field[] = [
  { key: "announcement", label: "Traka sa obaveštenjem", kind: "text", hint: "Prikazuje se na vrhu svake stranice. Prazno: trake nema." },
  { key: "announcementHref", label: "Traka: adresa linka", kind: "link" },
  { key: "menu", label: "Glavni meni", kind: "list", itemLabel: "Stavka", max: 8, fields: link },
  { key: "tagline", label: "Opis prodavnice", kind: "textarea", hint: "U podnožju i kao opis za pretraživače." },
  {
    key: "footerColumns",
    label: "Kolone podnožja",
    kind: "list",
    itemLabel: "Kolona",
    max: 4,
    fields: [
      { key: "title", label: "Naslov kolone", kind: "text" },
      { key: "links", label: "Linkovi", kind: "list", itemLabel: "Link", max: 8, fields: link },
    ],
  },
  { key: "footerNote", label: "Red pri dnu podnožja", kind: "text", hint: "Npr. načini plaćanja." },
  { key: "legalLinks", label: "Linkovi pri dnu podnožja", kind: "list", itemLabel: "Link", max: 4, fields: link },
];

export const defaultSite: SiteSettings = {
  announcement: "",
  announcementHref: "",
  menu: [
    { label: "Kolekcija", href: "/kolekcija" },
    { label: "O nama", href: "/o-nama" },
    { label: "Pitanja", href: "/pitanja" },
    { label: "Kontakt", href: "/kontakt" },
  ],
  tagline: "Nameštaj od masivnog drveta i prirodnih tkanina, izrađen u malim serijama.",
  footerColumns: [
    {
      title: "Kupovina",
      links: [
        { label: "Sve kolekcije", href: "/kolekcija" },
        { label: "Fotelje", href: "/kolekcija?kategorija=Fotelje" },
        { label: "Stolice", href: "/kolekcija?kategorija=Stolice" },
        { label: "Barske stolice", href: "/kolekcija?kategorija=Barske" },
      ],
    },
    {
      title: "Pomoć",
      links: [
        { label: "Česta pitanja", href: "/pitanja" },
        { label: "Dostava i povrat", href: "/pitanja?tema=Dostava" },
        { label: "Kontakt", href: "/kontakt" },
        { label: "Moj nalog", href: "/nalog" },
      ],
    },
    {
      title: "Kompanija",
      links: [
        { label: "O nama", href: "/o-nama" },
        { label: "Naš proces", href: "/o-nama#proces" },
        { label: "Salon", href: "/kontakt#salon" },
      ],
    },
  ],
  footerNote: "Plaćanje pouzećem ili uplatom na račun",
  legalLinks: [],
};

/** Sačuvan zapis sveden na opis polja; bez zapisa važe početne vrednosti. */
export function mergeSite(saved: unknown): SiteSettings {
  return normalizeData(SITE_FIELDS, saved ?? defaultSite) as SiteSettings;
}

const fontOptions = FONTS.map((font) => ({ value: font.id as string, label: font.label }));

/** Tema u panelu: četiri boje i dva fonta (lib/theme.ts). Važe za sajt; boje i za email. */
export const THEME_FIELDS: Field[] = [
  ...(Object.keys(defaultColors) as (keyof ThemeColors)[]).map(
    (key): Field => ({ key, label: colorLabels[key], kind: "color", initial: defaultColors[key] }),
  ),
  { key: "fontDisplay", label: "Font naslova", kind: "select", options: fontOptions },
  { key: "fontBody", label: "Font teksta", kind: "select", options: fontOptions },
];
