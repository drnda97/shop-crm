import { HOME_SLUG, type Page } from "@/lib/catalog";
import { normalizeSections } from "@/lib/sections";

/**
 * Stranice koje nova prodavnica dobija pri prvom pokretanju (migracija 2): sadržaj teme,
 * koji vlasnik zatim menja u panelu. Pravne stranice su nacrti sa mestima za dopunu.
 */

const img = (file: string, alt: string, position = "") => ({ src: `/shop/${file}`, alt, position });

type Draft = Pick<Page, "slug" | "title"> & { published?: boolean; sections: { type: string; data: object }[] };

const drafts: Draft[] = [
  {
    slug: HOME_SLUG,
    title: "Početna",
    sections: [
      {
        type: "hero",
        data: {
          title: "Komadi oko\nkojih se\ngradi dom.",
          text: "Fotelje, stolice i sofe od masivnog drveta i prirodnih tkanina, izrađene u malim serijama.",
          image: img("ds-hero.jpg", "Senf žuta sofa ispred tamnog petrolej zida", "70% 60%"),
          buttonLabel: "Pogledajte kolekciju",
          buttonHref: "/kolekcija",
          linkLabel: "Kako nastaje naš nameštaj",
          linkHref: "/o-nama",
          product: "okretna-fotelja-mio",
        },
      },
      {
        type: "features",
        data: {
          items: [
            { icon: "leaf", title: "Prirodni materijali", text: "Masivno drvo, lan, vuna i koža koji lepo stare." },
            { icon: "truck", title: "Dostava do stana", text: "Besplatna preko 50.000 RSD, sa unošenjem i montažom." },
            { icon: "shield", title: "Pet godina garancije", text: "I povrat u roku od 30 dana ako se predomislite." },
          ],
        },
      },
      {
        type: "tiles",
        data: {
          heading: "Počnite od prostorije",
          linkLabel: "Sve kategorije",
          linkHref: "/kolekcija",
          items: [
            { image: img("ds-cognac.jpg", "Kožna sofa u dnevnoj sobi"), title: "Dnevna soba", text: "Sofe, fotelje, stočići", href: "/kolekcija" },
            { image: img("ds-dining-a.jpg", "Trpezarijski sto sa belim stolicama"), title: "Trpezarija", text: "Stolice, stolovi, klupe", href: "/kolekcija" },
            { image: img("ds-armchair-plant.jpg", "Fotelja od buklea pored stočića"), title: "Kutak za čitanje", text: "Fotelje, hoklice, lampe", href: "/kolekcija" },
          ],
        },
      },
      {
        type: "products",
        data: {
          heading: "Najprodavanije",
          collection: "",
          limit: "4",
          tabs: true,
          buttonLabel: "Pogledajte svih {broj} proizvoda",
          buttonHref: "/kolekcija",
        },
      },
      {
        type: "split",
        data: {
          eyebrow: "Usluga",
          heading: "Pomažemo vam da zamislite ceo prostor",
          text: "Pošaljite nam dimenzije i fotografije sobe. Naš dizajner predlaže raspored, tkanine i boje, bez naknade i bez obaveze kupovine.",
          linkLabel: "Zakažite savet",
          linkHref: "/kontakt?tema=savet",
          images: [{ image: img("ds-living-art.jpg", "Dnevna soba sa sofom, foteljama i umetničkom slikom") }],
          side: "left",
        },
      },
      {
        type: "split",
        data: {
          eyebrow: "Materijali",
          heading: "Ozbiljni materijali za nameštaj koji traje",
          text: "Radimo sa masivnim hrastom i orahom, pletenom trskom i tkaninama evropskih tkačnica. Svaki spoj se radi ručno i može da se popravi.",
          linkLabel: "Naš proces",
          linkHref: "/o-nama#proces",
          images: [
            { image: img("ds-detail-b.jpg", "Detalj drvenih letvica") },
            { image: img("ds-wood-b.jpg", "Ručno dletovanje drveta") },
            { image: img("ds-detail-a.jpg", "Detalj stolice od trske i drveta") },
          ],
          side: "right",
        },
      },
      {
        type: "banner",
        data: {
          image: img("ds-dark-sofa.jpg", "Tamna dnevna soba sa sivom sofom", "center 70%"),
          heading: "Sedite pre nego što kupite",
          text: "Sve modele možete probati u našem salonu: [ADRESA SALONA], radnim danima od [OD] do [DO].",
          buttonLabel: "Kako do nas",
          buttonHref: "/kontakt#salon",
          buttonStyle: "light",
        },
      },
      {
        type: "testimonials",
        data: {
          heading: "Iz domova naših kupaca",
          items: [
            { image: img("ds-room.jpg", "Dnevna soba sa velikim prozorima"), quote: "[Utisak kupca: jedna do dve rečenice o proizvodu ili isporuci.]", name: "[Ime kupca]", city: "[Grad]" },
            { image: img("ds-living-window.jpg", "Svetla dnevna soba sa ugaonom sofom"), quote: "[Utisak kupca: jedna do dve rečenice o proizvodu ili isporuci.]", name: "[Ime kupca]", city: "[Grad]" },
            { image: img("ds-dining-b.jpg", "Trpezarija sa okruglim stolom"), quote: "[Utisak kupca: jedna do dve rečenice o proizvodu ili isporuci.]", name: "[Ime kupca]", city: "[Grad]" },
          ],
        },
      },
      {
        type: "newsletter",
        data: {
          heading: "Novi modeli stižu jednom mesečno",
          text: "Prijavite se i javićemo vam pre svih, uz 10% popusta na prvu porudžbinu.",
          image: img("ds-leather.jpg", "Kožna sofa u popodnevnom svetlu", "30% center"),
        },
      },
    ],
  },
  {
    slug: "o-nama",
    title: "O nama",
    sections: [
      {
        type: "intro",
        data: {
          title: "Pravimo nameštaj\nkoji se nasleđuje.",
          text: "Demo Shop je nastao iz jedne radionice i uverenja da stolica treba da traje duže od kredita kojim je kupljena.",
        },
      },
      { type: "photo", data: { image: img("ds-living-window.jpg", "Dnevna soba sa kožnom ugaonom sofom i pogledom na baštu", "center 60%") } },
      {
        type: "text",
        data: {
          heading: "Počeli smo sa jednim stolom i tri majstora",
          body: "Radimo sa malim radionicama koje poznajemo lično. Svaki komad prolazi kroz naše ruke pre nego što stigne do vas, i svaki nosi ime majstora koji ga je sastavio.\n\nNe pratimo sezone. Kolekciju dopunjujemo samo kada napravimo nešto što zaslužuje mesto u njoj, a ono što jednom uvrstimo ostaje u ponudi godinama, zajedno sa rezervnim delovima.\n\n[Ovde dopunite priču svog brenda: godina osnivanja, ko stoji iza prodavnice i šta vas izdvaja.]",
        },
      },
      {
        type: "cards",
        data: {
          items: [
            { icon: "leaf", title: "Materijal", text: "Masivno drvo iz kontrolisane seče, vuna, lan i biljno štavljena koža. Bez iverice i bez plastike na vidljivim mestima.", dark: false },
            { icon: "pen", title: "Izrada", text: "Male serije i ručna završna obrada. Spojevi su klasični stolarski, pa se svaki deo može rastaviti i popraviti.", dark: false },
            { icon: "shield", title: "Odgovornost", text: "Pet godina garancije na svaki komad i deset godina dostupnosti rezervnih delova. Stojimo iza svega što prodamo.", dark: true },
          ],
        },
      },
      {
        type: "steps",
        data: {
          anchor: "proces",
          heading: "Od daske do vašeg doma",
          images: [
            { image: img("ds-wood-b.jpg", "Ručno dletovanje drveta") },
            { image: img("ds-detail-a.jpg", "Detalj stolice od trske") },
          ],
          items: [
            { title: "Crtež i prototip", text: "Svaki model mesecima koristimo u sopstvenim domovima pre nego što uđe u ponudu." },
            { title: "Izrada po porudžbini", text: "Birate tkaninu i drvo, a mi komad pravimo za vas. Bez zaliha koje završavaju na rasprodaji." },
            { title: "Dostava i montaža", text: "Naš tim unosi, sastavlja i odnosi ambalažu. Vi samo sednete." },
          ],
        },
      },
      {
        type: "banner",
        data: {
          image: img("ds-green-sofa.jpg", "Zelena sofa", "center 55%"),
          heading: "Pogledajte šta smo napravili",
          text: "",
          buttonLabel: "Otvorite kolekciju",
          buttonHref: "/kolekcija",
          buttonStyle: "gold",
        },
      },
    ],
  },
  {
    slug: "pitanja",
    title: "Česta pitanja",
    sections: [
      {
        type: "intro",
        data: { title: "Česta pitanja", text: "Dostava, plaćanje, povrat i održavanje. Ako ne nađete odgovor, pišite nam." },
      },
      {
        type: "faq",
        data: {
          items: [
            { topic: "Dostava", question: "Koliko traje isporuka?", answer: "Nameštaj izrađujemo po porudžbini, pa isporuka traje 5 do 10 radnih dana. Termin dostave dogovaramo telefonom dan ranije." },
            { topic: "Dostava", question: "Koliko košta dostava?", answer: "Dostava sa unošenjem i montažom je besplatna za porudžbine preko 50.000 RSD. Za manje iznose cena je 1.200 RSD, bez obzira na broj komada." },
            { topic: "Dostava", question: "Da li unosite i sastavljate nameštaj?", answer: "Da. Naš tim unosi komade u stan, sastavlja ih i odnosi ambalažu. Napišite nam sprat i da li zgrada ima lift." },
            { topic: "Plaćanje", question: "Koje načine plaćanja prihvatate?", answer: "Plaćanje pouzećem i uplatu na račun. Sve cene su u dinarima, sa uračunatim PDV-om." },
            { topic: "Plaćanje", question: "Da li mogu da platim na rate?", answer: "[Dopunite: banke, broj rata i uslovi plaćanja na rate.]" },
            { topic: "Povrat", question: "Kako mogu da vratim proizvod?", answer: "Proizvod možete vratiti u roku od 30 dana od isporuke, neoštećen. Pišite nam i poslaćemo tim po njega." },
            { topic: "Povrat", question: "Kada dobijam novac nazad?", answer: "Novac vraćamo u roku od 14 dana od preuzimanja vraćenog proizvoda, na isti način na koji je porudžbina plaćena." },
            { topic: "Proizvodi", question: "Mogu li da dobijem uzorke tkanina?", answer: "Da, šaljemo do pet besplatnih uzoraka tkanina i drveta na vašu adresu. Poručite ih preko kontakt forme." },
            { topic: "Proizvodi", question: "Šta pokriva garancija?", answer: "Pet godina garancije pokriva konstrukciju, spojeve i mehanizme. Rezervne delove za svaki model čuvamo deset godina." },
          ],
        },
      },
      {
        type: "cta",
        data: {
          heading: "Niste našli odgovor?",
          text: "Pišite nam ili pozovite. Odgovaramo istog radnog dana.",
          buttonLabel: "Kontaktirajte nas",
          buttonHref: "/kontakt",
        },
      },
    ],
  },
  {
    slug: "kontakt",
    title: "Kontakt",
    sections: [
      {
        type: "intro",
        data: {
          title: "Javite se",
          text: "Pitanje o modelu, uzorci tkanina ili savet oko rasporeda. Odgovaramo u roku od jednog radnog dana.",
        },
      },
      {
        type: "contact",
        data: {
          image: img("ds-room.jpg", "Dnevna soba sa velikim prozorima"),
          hours: [
            { days: "Ponedeljak do petka", time: "[OD] do [DO]" },
            { days: "Subota", time: "[OD] do [DO]" },
            { days: "Nedelja", time: "Zatvoreno" },
          ],
          topics: [
            { name: "Pitanje o proizvodu" },
            { name: "Uzorci tkanina" },
            { name: "Savet dizajnera" },
            { name: "Moja porudžbina" },
            { name: "Povrat ili reklamacija" },
          ],
        },
      },
      {
        type: "banner",
        data: {
          anchor: "salon",
          image: img("ds-living-art.jpg", "Izložbeni prostor sa sofom i foteljama", "center 60%"),
          heading: "Dođite u salon",
          text: "Svi modeli su izloženi, a uzorke tkanina i drveta možete poneti kući.",
          buttonLabel: "Otvori mapu",
          buttonHref: "/kontakt#salon",
          buttonStyle: "light",
        },
      },
    ],
  },
  {
    slug: "uslovi-kupovine",
    title: "Uslovi kupovine",
    published: false,
    sections: [
      { type: "intro", data: { title: "Uslovi kupovine", text: "" } },
      { type: "text", data: { heading: "Prodavac", body: "[Dopunite: pun naziv firme, adresa sedišta, matični broj, PIB, email i telefon.]" } },
      { type: "text", data: { heading: "Poručivanje i cene", body: "[Dopunite: kako se poručuje, kada je porudžbina potvrđena, da li cene sadrže PDV.]" } },
      { type: "text", data: { heading: "Plaćanje", body: "[Dopunite: načini plaćanja koje prihvatate i kada se plaćanje vrši.]" } },
      { type: "text", data: { heading: "Isporuka", body: "[Dopunite: rok isporuke, cena dostave, kurirska služba, područje isporuke.]" } },
    ],
  },
  {
    slug: "povrat-i-reklamacije",
    title: "Povrat i reklamacije",
    published: false,
    sections: [
      { type: "intro", data: { title: "Povrat i reklamacije", text: "" } },
      { type: "text", data: { heading: "Odustanak od kupovine", body: "[Dopunite: rok u kom kupac može da odustane, kako to prijavljuje, ko snosi trošak vraćanja i u kom roku vraćate novac.]" } },
      { type: "text", data: { heading: "Reklamacije", body: "[Dopunite: kako se podnosi reklamacija, na koju adresu, u kom roku odgovarate i kako se rešava.]" } },
    ],
  },
  {
    slug: "privatnost",
    title: "Privatnost",
    published: false,
    sections: [
      { type: "intro", data: { title: "Politika privatnosti", text: "" } },
      { type: "text", data: { heading: "Koje podatke prikupljamo", body: "[Dopunite: podaci koje kupac ostavlja pri porudžbini, registraciji i prijavi na novosti.]" } },
      { type: "text", data: { heading: "Zašto ih prikupljamo i koliko ih čuvamo", body: "[Dopunite: svrha obrade (isporuka, račun, novosti), pravni osnov i rok čuvanja.]" } },
      { type: "text", data: { heading: "Vaša prava", body: "[Dopunite: kako kupac traži uvid, ispravku ili brisanje podataka i kome se obraća.]" } },
    ],
  },
];

export const DEFAULT_PAGES: Page[] = drafts.map((draft) => ({
  slug: draft.slug,
  title: draft.title,
  // Ista vrsta dva puta na stranici dobija nastavak -2, -3 (normalizeSections).
  sections: normalizeSections(draft.sections.map((section) => ({ ...section, id: section.type }))),
  seoTitle: "",
  seoDescription: "",
  published: draft.published ?? true,
  showInFooter: false,
}));
