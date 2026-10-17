import { normalizeData, type Field } from "@/lib/sections";
import { colorLabels, defaultColors, FONTS, type ThemeColors } from "@/lib/theme";

/**
 * Delovi sajta koji su isti na svakoj stranici, podeljeni kao u Shopify-ju na zaglavlje
 * (traka sa obaveštenjima i glavni meni) i podnožje. Menjaju se u panelu (Izgled sajta →
 * Zaglavlje, Podnožje), a čuvaju uz ostala podešavanja. Polja su opisana isto kao polja
 * sekcija, pa ih panel uređuje istom formom.
 */

export type MenuLink = { label: string; href: string };

/** Jedna poruka u traci sa obaveštenjima. */
export type Announcement = { text: string; href: string };

/** Kako traka prikazuje više poruka: jednu po jednu (slider) ili sve u nizu koji klizi. */
export type AnnouncementMode = "slider" | "marquee";
export type AnnouncementTone = "dark" | "gold" | "light";

export type SiteSettings = {
  /** Poruke u traci na vrhu svake stranice; bez poruka trake nema. */
  announcements: Announcement[];
  announcementMode: AnnouncementMode;
  /** Sekundi po poruci u slideru, odnosno brzina niza koji klizi. */
  announcementSpeed: string;
  announcementTone: AnnouncementTone;
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

/** Zaglavlje: traka sa obaveštenjima na vrhu svake stranice i glavni meni. */
export const HEADER_FIELDS: Field[] = [
  {
    key: "announcements",
    label: "Traka sa obaveštenjima",
    kind: "list",
    itemLabel: "Poruka",
    max: 6,
    hint: "Na vrhu svake stranice. Više poruka se smenjuje ili klizi, po izboru ispod. Bez poruka trake nema.",
    fields: [
      { key: "text", label: "Tekst poruke", kind: "text" },
      { key: "href", label: "Adresa linka (neobavezno)", kind: "link" },
    ],
  },
  {
    key: "announcementMode",
    label: "Kako se prikazuje više poruka",
    kind: "select",
    options: [
      { value: "slider", label: "Jedna po jedna (slider sa strelicama)" },
      { value: "marquee", label: "Sve u nizu koji klizi" },
    ],
  },
  {
    key: "announcementSpeed",
    label: "Brzina",
    kind: "select",
    options: [
      { value: "4", label: "Brzo (4 s po poruci)" },
      { value: "6", label: "Srednje (6 s po poruci)" },
      { value: "9", label: "Sporo (9 s po poruci)" },
    ],
  },
  {
    key: "announcementTone",
    label: "Boja trake",
    kind: "select",
    options: [
      { value: "dark", label: "Tamna (boja teksta)" },
      { value: "gold", label: "Akcenat" },
      { value: "light", label: "Svetla" },
    ],
  },
  { key: "menu", label: "Glavni meni", kind: "list", itemLabel: "Stavka", max: 8, fields: link },
];

/** Podnožje: opis prodavnice, kolone sa linkovima i red pri dnu. */
export const FOOTER_FIELDS: Field[] = [
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

export const SITE_FIELDS: Field[] = [...HEADER_FIELDS, ...FOOTER_FIELDS];

export const defaultSite: SiteSettings = {
  announcements: [],
  announcementMode: "slider",
  announcementSpeed: "6",
  announcementTone: "dark",
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
        { label: "Fotelje", href: "/kolekcija?kategorija=fotelje" },
        { label: "Stolice", href: "/kolekcija?kategorija=stolice" },
        { label: "Barske stolice", href: "/kolekcija?kategorija=barske" },
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

/**
 * Sačuvan zapis sveden na opis polja; bez zapisa važe početne vrednosti. Zapis iz ranije
 * verzije (jedna poruka u `announcement` i `announcementHref`) postaje prva poruka trake.
 */
export function mergeSite(saved: unknown): SiteSettings {
  const record = (saved ?? defaultSite) as Record<string, unknown>;
  const legacy = typeof record.announcement === "string" && record.announcement.trim() !== "" && !Array.isArray(record.announcements);
  const value = legacy
    ? { ...record, announcements: [{ text: record.announcement, href: typeof record.announcementHref === "string" ? record.announcementHref : "" }] }
    : record;
  const site = normalizeData(SITE_FIELDS, value) as SiteSettings;
  // Poruka bez teksta se ne prikazuje.
  return { ...site, announcements: site.announcements.filter((item) => item.text.trim() !== "") };
}

const fontOptions = FONTS.map((font) => ({ value: font.id as string, label: font.label }));

/** Tema u panelu: četiri boje i dva fonta (lib/theme.ts). Važe za sajt; boje i za email. */
export const THEME_FIELDS: Field[] = [
  ...(Object.keys(defaultColors) as (keyof ThemeColors)[]).map(
    (key): Field => ({ key, label: colorLabels[key], kind: "color", initial: defaultColors[key] }),
  ),
  { key: "fontDisplay", label: "Font naslova", kind: "select", options: fontOptions },
  { key: "fontBody", label: "Font teksta", kind: "select", options: fontOptions },
  {
    key: "customCss",
    label: "Sopstveni CSS",
    kind: "textarea",
    hint: "Za one koji znaju CSS: dodaje se posle stilova teme i važi samo za ovu temu. Prazno: nema ga.",
  },
];
