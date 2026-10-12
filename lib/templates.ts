import { ICONS, normalizeData, type Field, type ImageValue } from "@/lib/sections";

/**
 * Stranice prodavnice sa stalnim rasporedom: kolekcija, proizvod, nalog, plaćanje i korpa.
 * Raspored je u temi, a tekstovi i fotografije se menjaju u panelu (Izgled sajta).
 * Polja su opisana isto kao polja sekcija; početne vrednosti su sadržaj iz dizajna.
 *
 * Natpisi na dugmadima i poljima formi („Dodaj u korpu", „Email adresa") nisu ovde: oni su
 * deo teme i prevodiće se zajedno sa njom.
 */

export type Templates = {
  collection: {
    image: ImageValue;
    title: string;
    text: string;
    searchPlaceholder: string;
    promoHeading: string;
    promoText: string;
    promoButtonLabel: string;
    promoButtonHref: string;
    promoImage: ImageValue;
  };
  product: {
    priceNote: string;
    notes: { icon: string; text: string }[];
    info: { title: string; text: string }[];
    relatedHeading: string;
    relatedLinkLabel: string;
  };
  account: {
    image: ImageValue;
    imageHeading: string;
    imageText: string;
    loginHeading: string;
    loginText: string;
    registerHeading: string;
    registerText: string;
    termsHref: string;
    privacyHref: string;
  };
  checkout: {
    heading: string;
    termsNote: string;
    termsHref: string;
    priceNote: string;
  };
  cart: {
    emptyHeading: string;
    emptyText: string;
    footNote: string;
    upsell: string;
  };
};

export type TemplateId = keyof Templates;

type Template = {
  id: TemplateId;
  /** Oznaka u adresi panela: /admin/izgled/{slug}. */
  slug: string;
  label: string;
  hint: string;
  fields: Field[];
};

const photo = (file: string, alt: string, position = ""): ImageValue => ({ src: `/shop/${file}`, alt, position });

export const TEMPLATES: Template[] = [
  {
    id: "collection",
    slug: "kolekcija",
    label: "Kolekcija",
    hint: "Stranica sa svim proizvodima: baner na vrhu i poziv ispod mreže proizvoda.",
    fields: [
      { key: "image", label: "Fotografija banera", kind: "image", initial: photo("ds-green-sofa.jpg", "Zelena sofa u svetloj sobi", "center 55%") },
      { key: "title", label: "Naslov", kind: "text", initial: "Sedenje" },
      { key: "text", label: "Tekst uz naslov", kind: "textarea", initial: "Fotelje, stolice i barske stolice. Svaki model dolazi u više tkanina i završnih obrada drveta." },
      { key: "searchPlaceholder", label: "Tekst u polju za pretragu", kind: "text", initial: "Naziv, kategorija ili tkanina" },
      { key: "promoHeading", label: "Poziv ispod proizvoda: naslov", kind: "text", hint: "Bez naslova se ceo poziv ne prikazuje.", initial: "Niste sigurni koja tkanina?" },
      { key: "promoText", label: "Poziv: tekst", kind: "textarea", initial: "Šaljemo besplatne uzorke tkanina i drveta na vašu adresu, da ih vidite pri svom svetlu pre nego što poručite." },
      { key: "promoButtonLabel", label: "Poziv: tekst dugmeta", kind: "text", initial: "Poručite uzorke" },
      { key: "promoButtonHref", label: "Poziv: adresa dugmeta", kind: "link", initial: "/kontakt?tema=uzorci" },
      { key: "promoImage", label: "Poziv: fotografija", kind: "image", initial: photo("ds-leather.jpg", "Kožna sofa pored prozora") },
    ],
  },
  {
    id: "product",
    slug: "proizvod",
    label: "Proizvod",
    hint: "Delovi koji su isti na stranici svakog proizvoda. Opis, opcije, slike i istaknuti deo se upisuju uz sam proizvod.",
    fields: [
      { key: "priceNote", label: "Napomena uz cenu", kind: "text", initial: "PDV uračunat" },
      {
        key: "notes",
        label: "Prednosti ispod dugmeta",
        kind: "list",
        itemLabel: "Prednost",
        max: 4,
        fields: [
          { key: "icon", label: "Ikonica", kind: "select", options: ICONS },
          { key: "text", label: "Tekst", kind: "text" },
        ],
        initial: [
          { icon: "truck", text: "Besplatna dostava za porudžbine preko 50.000 RSD" },
          { icon: "shield", text: "5 godina garancije, povrat u roku od 30 dana" },
        ],
      },
      {
        key: "info",
        label: "Obaveštenja za sve proizvode",
        hint: "Prikazuju se ispod dodatnih sekcija svakog proizvoda, npr. dostava i povrat.",
        kind: "list",
        itemLabel: "Obaveštenje",
        max: 6,
        fields: [
          { key: "title", label: "Naslov", kind: "text" },
          { key: "text", label: "Tekst", kind: "textarea" },
        ],
        initial: [
          {
            title: "Dostava i povrat",
            text: "Isporuka za 5 do 10 radnih dana, sa unošenjem i montažom. Dostava je besplatna za porudžbine preko 50.000 RSD, a proizvod možete vratiti u roku od 30 dana.",
          },
        ],
      },
      { key: "relatedHeading", label: "Naslov iznad sličnih proizvoda", kind: "text", initial: "Lepo ide uz ovaj model" },
      { key: "relatedLinkLabel", label: "Link ka kolekciji", kind: "text", initial: "Cela kolekcija" },
    ],
  },
  {
    id: "account",
    slug: "nalog",
    label: "Nalog kupca",
    hint: "Stranica za prijavu i registraciju.",
    fields: [
      { key: "image", label: "Fotografija", kind: "image", initial: photo("ds-cognac.jpg", "Kožna sofa sa žutim jastukom") },
      { key: "imageHeading", label: "Naslov preko fotografije", kind: "text", initial: "Sve vaše porudžbine na jednom mestu" },
      { key: "imageText", label: "Tekst preko fotografije", kind: "textarea", initial: "Pratite isporuku i ponovite porudžbinu u nekoliko klikova." },
      { key: "loginHeading", label: "Prijava: naslov", kind: "text", initial: "Dobro došli nazad" },
      { key: "loginText", label: "Prijava: tekst", kind: "text", initial: "Prijavite se da biste videli svoje porudžbine." },
      { key: "registerHeading", label: "Registracija: naslov", kind: "text", initial: "Napravite nalog" },
      { key: "registerText", label: "Registracija: tekst", kind: "text", initial: "Brža kupovina, praćenje isporuke i 10% popusta na prvu porudžbinu." },
      { key: "termsHref", label: "Adresa uslova korišćenja", kind: "link", hint: "Link u rečenici ispod dugmeta za registraciju.", initial: "/uslovi-kupovine" },
      { key: "privacyHref", label: "Adresa politike privatnosti", kind: "link", initial: "/privatnost" },
    ],
  },
  {
    id: "checkout",
    slug: "placanje",
    label: "Plaćanje",
    hint: "Stranica na kojoj kupac upisuje podatke i potvrđuje porudžbinu. Načini dostave (naziv, cena, zona) i načini plaćanja su u Podešavanjima.",
    fields: [
      { key: "heading", label: "Naslov", kind: "text", initial: "Završite porudžbinu" },
      { key: "termsNote", label: "Rečenica uz uslove kupovine", kind: "text", hint: "Stoji iza „Potvrdom prihvatate uslove kupovine.”", initial: "Povrat je moguć u roku od 30 dana." },
      { key: "termsHref", label: "Adresa uslova kupovine", kind: "link", initial: "/uslovi-kupovine" },
      { key: "priceNote", label: "Napomena ispod ukupnog iznosa", kind: "text", initial: "PDV je uračunat u cenu" },
    ],
  },
  {
    id: "cart",
    slug: "korpa",
    label: "Korpa",
    hint: "Korpa koja se otvara sa desne strane. U pregledu kliknite na „Korpa” da je vidite.",
    fields: [
      { key: "emptyHeading", label: "Prazna korpa: naslov", kind: "text", initial: "Korpa je prazna" },
      { key: "emptyText", label: "Prazna korpa: tekst", kind: "textarea", initial: "Dodajte komad koji vam se dopao i vratite se ovde da završite kupovinu." },
      { key: "footNote", label: "Napomena ispod dugmeta", kind: "text", initial: "PDV je uračunat. Povrat u roku od 30 dana." },
      { key: "upsell", label: "Predlog do besplatne dostave", kind: "product", hint: "Proizvod koji se nudi dok korpa ne dostigne besplatnu dostavu. Bez izbora: najjeftiniji proizvod." },
    ],
  },
];

export function template(id: string): Template | undefined {
  return TEMPLATES.find((candidate) => candidate.id === id);
}

/** Sačuvan zapis sveden na opis polja; šablon ili polje bez zapisa dobija početnu vrednost. */
export function mergeTemplates(saved: unknown): Templates {
  const source = (typeof saved === "object" && saved !== null ? saved : {}) as Record<string, unknown>;
  return Object.fromEntries(
    TEMPLATES.map((item) => [item.id, normalizeData(item.fields, source[item.id])]),
  ) as Templates;
}
