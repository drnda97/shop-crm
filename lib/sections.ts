/**
 * Sekcije: delovi od kojih se slažu stranice prodavnice. Ovde su vrste sekcija i opis
 * njihovih polja — iz tog opisa panel pravi formu, a prodavnica čita sadržaj.
 * Kako sekcija izgleda na sajtu određuje tema (themes/default/sections).
 *
 * Bez pristupa bazi, pa sme i u "use client" komponente.
 */

export type ImageValue = {
  src: string;
  /** Šta je na slici, za čitače ekrana i pretraživače. */
  alt: string;
  /** Koji deo slike ostaje vidljiv kada se iseca (CSS object-position); prazno: sredina. */
  position: string;
};

/** Ponuđena isecanja slike u panelu. */
export const IMAGE_POSITIONS = [
  { value: "", label: "sredina" },
  { value: "top", label: "gornji deo" },
  { value: "bottom", label: "donji deo" },
  { value: "left", label: "leva strana" },
  { value: "right", label: "desna strana" },
];

type FieldBase = {
  key: string;
  label: string;
  /** Kratko uputstvo ispod polja. */
  hint?: string;
};

export type Field =
  | (FieldBase & { kind: "text" | "textarea" | "link"; initial?: string })
  | (FieldBase & { kind: "boolean"; initial?: boolean })
  | (FieldBase & { kind: "image"; initial?: ImageValue })
  /** Boja u zapisu #rrggbb. */
  | (FieldBase & { kind: "color"; initial: string })
  | (FieldBase & { kind: "select"; options: { value: string; label: string }[] })
  /** Izbor iz kataloga; prazno znači „nije izabrano". */
  | (FieldBase & { kind: "collection" | "product" })
  | (FieldBase & { kind: "list"; itemLabel: string; fields: Field[]; max?: number; initial?: SectionData[] });

export type SectionData = Record<string, unknown>;

export type Section = {
  /** Jedinstven u okviru stranice. */
  id: string;
  type: string;
  data: SectionData;
};

export type SectionType = {
  type: string;
  label: string;
  /** Čemu sekcija služi, za spisak pri dodavanju. */
  hint: string;
  fields: Field[];
};

const TEXT_MAX = 300;
const TEXTAREA_MAX = 5000;
const LIST_MAX = 30;

/** Ikonice koje tema ume da nacrta. */
export const ICONS = [
  { value: "leaf", label: "List" },
  { value: "truck", label: "Kamion" },
  { value: "shield", label: "Štit" },
  { value: "pen", label: "Olovka" },
  { value: "check", label: "Kvačica" },
];

const icon: Field = { key: "icon", label: "Ikonica", kind: "select", options: ICONS };
const image: Field = { key: "image", label: "Fotografija", kind: "image" };

function button(prefix: string, label: string): Field[] {
  return [
    { key: `${prefix}Label`, label: `${label}: tekst`, kind: "text" },
    { key: `${prefix}Href`, label: `${label}: adresa`, kind: "link" },
  ];
}

const sections: SectionType[] = [
  {
    type: "hero",
    label: "Glavni baner",
    hint: "Velika fotografija sa naslovom i dugmetom, na vrhu početne strane.",
    fields: [
      { key: "title", label: "Naslov", kind: "textarea", hint: "Svaki red je jedan red naslova.", initial: "Naslov prodavnice" },
      { key: "text", label: "Tekst", kind: "textarea" },
      image,
      ...button("button", "Dugme"),
      ...button("link", "Link pored dugmeta"),
      { key: "product", label: "Istaknut proizvod", kind: "product", hint: "Kartica sa nazivom i cenom preko fotografije." },
    ],
  },
  {
    type: "features",
    label: "Prednosti",
    hint: "Do četiri kratke prednosti sa ikonicom, u beloj kartici.",
    fields: [
      {
        key: "items",
        label: "Prednosti",
        kind: "list",
        itemLabel: "Prednost",
        max: 4,
        fields: [icon, { key: "title", label: "Naslov", kind: "text" }, { key: "text", label: "Tekst", kind: "text" }],
      },
    ],
  },
  {
    type: "tiles",
    label: "Pločice sa slikama",
    hint: "Fotografije sa naslovom koje vode na kategoriju ili stranicu.",
    fields: [
      { key: "heading", label: "Naslov", kind: "text", initial: "Naslov sekcije" },
      ...button("link", "Link uz naslov"),
      {
        key: "items",
        label: "Pločice",
        kind: "list",
        itemLabel: "Pločica",
        max: 6,
        fields: [
          image,
          { key: "title", label: "Naslov", kind: "text" },
          { key: "text", label: "Tekst", kind: "text" },
          { key: "href", label: "Adresa", kind: "link", initial: "/kolekcija" },
        ],
      },
    ],
  },
  {
    type: "products",
    label: "Proizvodi",
    hint: "Mreža proizvoda: svi ili iz jedne kolekcije.",
    fields: [
      { key: "heading", label: "Naslov", kind: "text", initial: "Proizvodi" },
      { key: "collection", label: "Kolekcija", kind: "collection", hint: "Bez izbora se prikazuju svi proizvodi." },
      {
        key: "limit",
        label: "Broj proizvoda",
        kind: "select",
        options: [
          { value: "4", label: "4" },
          { value: "8", label: "8" },
          { value: "12", label: "12" },
        ],
      },
      { key: "tabs", label: "Tabovi po kategoriji", kind: "boolean", initial: true },
      { key: "buttonLabel", label: "Dugme: tekst", kind: "text", hint: "{broj} se menja ukupnim brojem proizvoda." },
      { key: "buttonHref", label: "Dugme: adresa", kind: "link", initial: "/kolekcija" },
    ],
  },
  {
    type: "split",
    label: "Tekst sa slikom",
    hint: "Naslov i tekst pored jedne do tri fotografije.",
    fields: [
      { key: "eyebrow", label: "Natpis iznad naslova", kind: "text" },
      { key: "heading", label: "Naslov", kind: "text", initial: "Naslov sekcije" },
      { key: "text", label: "Tekst", kind: "textarea" },
      ...button("link", "Link"),
      { key: "images", label: "Fotografije", kind: "list", itemLabel: "Fotografija", max: 3, fields: [image] },
      {
        key: "side",
        label: "Fotografije su",
        kind: "select",
        options: [
          { value: "left", label: "levo" },
          { value: "right", label: "desno" },
        ],
      },
    ],
  },
  {
    type: "banner",
    label: "Baner sa slikom",
    hint: "Široka fotografija sa naslovom, tekstom i dugmetom.",
    fields: [
      image,
      { key: "heading", label: "Naslov", kind: "text", initial: "Naslov banera" },
      { key: "text", label: "Tekst", kind: "textarea" },
      ...button("button", "Dugme"),
      {
        key: "buttonStyle",
        label: "Boja dugmeta",
        kind: "select",
        options: [
          { value: "light", label: "svetla" },
          { value: "gold", label: "zlatna" },
        ],
      },
    ],
  },
  {
    type: "testimonials",
    label: "Utisci kupaca",
    hint: "Fotografije sa izjavom kupca.",
    fields: [
      { key: "heading", label: "Naslov", kind: "text", initial: "Utisci kupaca" },
      {
        key: "items",
        label: "Utisci",
        kind: "list",
        itemLabel: "Utisak",
        max: 6,
        fields: [
          image,
          { key: "quote", label: "Izjava", kind: "textarea" },
          { key: "name", label: "Ime kupca", kind: "text" },
          { key: "city", label: "Grad", kind: "text" },
        ],
      },
    ],
  },
  {
    type: "newsletter",
    label: "Prijava na novosti",
    hint: "Forma za email adresu; prijave stižu u Poruke.",
    fields: [
      { key: "heading", label: "Naslov", kind: "text", initial: "Prijavite se na novosti" },
      { key: "text", label: "Tekst", kind: "textarea" },
      image,
    ],
  },
  {
    type: "intro",
    label: "Naslov stranice",
    hint: "Veliki naslov i kratak uvod, na vrhu stranice.",
    fields: [
      { key: "title", label: "Naslov", kind: "textarea", hint: "Svaki red je jedan red naslova.", initial: "Naslov stranice" },
      { key: "text", label: "Uvod", kind: "textarea" },
    ],
  },
  {
    type: "photo",
    label: "Široka fotografija",
    hint: "Jedna fotografija preko cele širine.",
    fields: [image],
  },
  {
    type: "text",
    label: "Tekst",
    hint: "Naslov i pasusi; za priču o brendu, uslove kupovine, privatnost.",
    fields: [
      { key: "heading", label: "Naslov", kind: "text" },
      { key: "body", label: "Tekst", kind: "textarea", hint: "Prazan red razdvaja pasuse." },
    ],
  },
  {
    type: "cards",
    label: "Kartice",
    hint: "Do četiri kartice sa ikonicom, naslovom i tekstom.",
    fields: [
      {
        key: "items",
        label: "Kartice",
        kind: "list",
        itemLabel: "Kartica",
        max: 4,
        fields: [
          icon,
          { key: "title", label: "Naslov", kind: "text" },
          { key: "text", label: "Tekst", kind: "textarea" },
          { key: "dark", label: "Tamna kartica", kind: "boolean" },
        ],
      },
    ],
  },
  {
    type: "steps",
    label: "Koraci",
    hint: "Numerisani koraci pored dve fotografije.",
    fields: [
      { key: "heading", label: "Naslov", kind: "text", initial: "Kako radimo" },
      { key: "images", label: "Fotografije", kind: "list", itemLabel: "Fotografija", max: 2, fields: [image] },
      {
        key: "items",
        label: "Koraci",
        kind: "list",
        itemLabel: "Korak",
        max: 8,
        fields: [
          { key: "title", label: "Naslov", kind: "text" },
          { key: "text", label: "Tekst", kind: "textarea" },
        ],
      },
    ],
  },
  {
    type: "faq",
    label: "Pitanja i odgovori",
    hint: "Pitanja grupisana po temama.",
    fields: [
      {
        key: "items",
        label: "Pitanja",
        kind: "list",
        itemLabel: "Pitanje",
        max: 60,
        fields: [
          { key: "topic", label: "Tema", kind: "text", hint: "Pitanja sa istom temom idu pod isti filter." },
          { key: "question", label: "Pitanje", kind: "text" },
          { key: "answer", label: "Odgovor", kind: "textarea" },
        ],
      },
    ],
  },
  {
    type: "cta",
    label: "Poziv na tamnoj traci",
    hint: "Naslov, rečenica i dugme na tamnoj pozadini.",
    fields: [
      { key: "heading", label: "Naslov", kind: "text", initial: "Naslov" },
      { key: "text", label: "Tekst", kind: "textarea" },
      ...button("button", "Dugme"),
    ],
  },
  {
    type: "contact",
    label: "Kontakt",
    hint: "Kontakt forma i podaci prodavnice. Email, telefon i adresa se čitaju iz Podešavanja → Prodavnica; red bez podatka se ne prikazuje.",
    fields: [
      { ...image, hint: "Po želji: fotografija salona ili radnje, iznad podataka." },
      {
        key: "hours",
        label: "Radno vreme",
        kind: "list",
        itemLabel: "Red",
        max: 7,
        fields: [
          { key: "days", label: "Dani", kind: "text" },
          { key: "time", label: "Vreme", kind: "text" },
        ],
      },
      {
        key: "topics",
        label: "Teme poruke",
        hint: "Šta kupac bira u polju „Tema“. Link sa ?tema=… otvara formu sa temom koja sadrži tu reč.",
        kind: "list",
        itemLabel: "Tema",
        max: 12,
        fields: [{ key: "name", label: "Tema", kind: "text" }],
      },
    ],
  },
];

/** Polje koje ima svaka sekcija: oznaka na koju može da vodi link (npr. /o-nama#proces). */
const anchor: Field = {
  key: "anchor",
  label: "Oznaka za link",
  kind: "text",
  hint: "Neobavezno. Sa oznakom „proces” link /stranica#proces vodi pravo na ovu sekciju.",
};

export const SECTION_TYPES: SectionType[] = sections.map((section) => ({
  ...section,
  fields: [...section.fields, anchor],
}));

export function sectionType(type: string): SectionType | undefined {
  return SECTION_TYPES.find((candidate) => candidate.type === type);
}

/**
 * Adresa linka koju je upisao vlasnik: putanja na sajtu, oznaka, ili puna adresa.
 * Sve ostalo (npr. javascript:) se odbacuje.
 */
export function safeHref(value: unknown): string {
  const href = typeof value === "string" ? value.trim().slice(0, 500) : "";
  if (/^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(href) && !/[\s<>"]/.test(href)) return href;
  return "";
}

/** Slika mora biti ubačena iz panela (/media/…) ili doći uz temu (/shop/…). */
export function safeImageSrc(value: unknown): string {
  const src = typeof value === "string" ? value : "";
  return /^\/(media|shop)\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(src) && !src.includes("..") ? src : "";
}

function asText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").slice(0, max) : "";
}

function normalizeValue(field: Field, raw: unknown): unknown {
  const missing = raw === undefined;
  switch (field.kind) {
    case "text":
      return missing ? (field.initial ?? "") : asText(raw, TEXT_MAX);
    case "textarea":
      return missing ? (field.initial ?? "") : asText(raw, TEXTAREA_MAX);
    case "link":
      return missing ? (field.initial ?? "") : safeHref(raw);
    case "boolean":
      return missing ? (field.initial ?? false) : raw === true;
    case "color":
      return typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : field.initial;
    case "image": {
      if (missing && field.initial) return field.initial;
      const value = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const position = typeof value.position === "string" ? value.position : "";
      return {
        src: safeImageSrc(value.src),
        alt: asText(value.alt, TEXT_MAX),
        position: /^[a-z0-9% ]{1,20}$/.test(position) ? position : "",
      };
    }
    case "select":
      return field.options.some((option) => option.value === raw) ? raw : field.options[0].value;
    case "collection":
    case "product":
      return typeof raw === "string" && /^[a-z0-9-]{1,191}$/.test(raw) ? raw : "";
    case "list":
      return (Array.isArray(raw) ? raw : missing ? (field.initial ?? []) : [])
        .slice(0, field.max ?? LIST_MAX)
        .map((item) => normalizeData(field.fields, item));
  }
}

/**
 * Sadržaj sveden na opis polja: polja koja nedostaju dobijaju početnu vrednost, pogrešan tip
 * i nepoznata polja se odbacuju. Poziva se pri upisu (podaci stižu iz pregledača) i pri
 * čitanju, pa tema uvek dobija sva polja i kada je opis sekcije kasnije proširen.
 */
export function normalizeData(fields: Field[], raw: unknown): SectionData {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(fields.map((field) => [field.key, normalizeValue(field, source[field.key])]));
}

/** Sekcije stranice iz zapisa u bazi ili iz pregledača; nepoznate vrste se preskaču. */
export function normalizeSections(raw: unknown): Section[] {
  const ids = new Set<string>();
  return (Array.isArray(raw) ? raw : []).slice(0, 60).flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { id, type, data } = entry as Record<string, unknown>;
    const definition = typeof type === "string" ? sectionType(type) : undefined;
    if (!definition) return [];
    let unique = typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id) ? id : "s";
    for (let n = 2; ids.has(unique); n++) unique = `${unique.replace(/-\d+$/, "")}-${n}`;
    ids.add(unique);
    return [{ id: unique, type: definition.type, data: normalizeData(definition.fields, data) }];
  });
}

/** Nova, prazna sekcija izabrane vrste. */
export function newSection(type: string, taken: string[]): Section | null {
  const definition = sectionType(type);
  if (!definition) return null;
  let id = type;
  for (let n = 2; taken.includes(id); n++) id = `${type}-${n}`;
  return { id, type, data: normalizeData(definition.fields, {}) };
}

/** Sve slike koje sadržaj koristi, redom kojim se pojavljuju. */
export function collectImages(fields: Field[], data: SectionData): ImageValue[] {
  return fields.flatMap((field) => {
    const value = data[field.key];
    if (field.kind === "image") {
      const image = value as ImageValue | undefined;
      return image?.src ? [image] : [];
    }
    if (field.kind === "list" && Array.isArray(value)) {
      return value.flatMap((item) => collectImages(field.fields, item as SectionData));
    }
    return [];
  });
}

/** Tekst sekcije „Tekst" kao pasusi: prazan red ih razdvaja. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
