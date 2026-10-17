import { COLUMN_HELP, EXPORT_HEADER } from "@/lib/product-import";
import type { XlsxSheet } from "@/lib/xlsx";

/**
 * Primer fajla za uvoz proizvoda (Proizvodi → Uvoz → Preuzmi primer): tri proizvoda koja
 * zajedno popunjavaju svaku kolonu, i list „Uputstvo" sa objašnjenjem kolona. Oznake počinju
 * sa „primer-", pa uvoz primera ne menja postojeće proizvode. Slike su fotografije teme (/shop/…).
 */

type Row = Partial<Record<(typeof EXPORT_HEADER)[number], string>>;

function rows(base: string): Row[] {
  const photo = (file: string) => `${base}/shop/${file}`;
  return [
    {
      oznaka: "primer-okretna-fotelja-luna",
      naziv: "Okretna fotelja Luna",
      status: "objavljen",
      kategorije: "Nameštaj > Fotelje | Akcija",
      kolekcije: "Bestseler | Novo",
      sifra: "LUNA",
      kratak_opis: "Pesak, hrast",
      opis: "Niska fotelja koja se okreće za 360°, sa sedištem od hladno livene pene.\n\nDovoljno mala za ugao, dovoljno udobna za celo veče.",
      detalji: "Dimenzije: Širina 72 cm, dubina 76 cm, visina 80 cm | Materijali: Vuna i lan, postolje od masivnog drveta | Održavanje: Navlaka se skida i pere na 30 °C",
      cena: "39900",
      cena_na_akciji: "35900",
      tezina_g: "14000",
      na_stanju: "da",
      komada: "",
      pri_kraju: "ispod praga",
      prag: "3",
      opcije: "Tkanina: Pesak #b9ab98, Grafit #3c4346 | Postolje: Hrast, Orah",
      slike: `${photo("ds-p-swivel.jpg")} ${photo("ds-detail-b.jpg")} ${photo("ds-armchair-plant.jpg")}`,
      istaknuto_naslov: "Napravljena da se popravlja",
      istaknuto_tekst: "Navlaka se skida i pere, a sedište i postolje se menjaju posebno.",
      istaknuto_mere: "Širina: 72 cm | Visina sedišta: 41 cm | Nosivost: 130 kg",
      istaknuto_slika: photo("ds-detail-a.jpg"),
      slicni: "primer-stolica-iva | primer-hoklica-bor",
      seo_naslov: "Okretna fotelja Luna — vuna i lan",
      seo_opis: "Niska okretna fotelja od vune i lana, na postolju od masivnog hrasta ili oraha.",
    },
    // Redovi varijanti: ista oznaka, kolona „varijanta" i ono što je samo njihovo.
    { oznaka: "primer-okretna-fotelja-luna", varijanta: "Pesak, Hrast", sifra: "LUNA-PH", komada: "5", u_ponudi: "da", slike: photo("ds-p-swivel.jpg") },
    { oznaka: "primer-okretna-fotelja-luna", varijanta: "Pesak, Orah", sifra: "LUNA-PO", cena: "42900", cena_na_akciji: "", komada: "2", u_ponudi: "da" },
    { oznaka: "primer-okretna-fotelja-luna", varijanta: "Grafit, Hrast", sifra: "LUNA-GH", komada: "8", u_ponudi: "da", slike: photo("ds-detail-b.jpg") },
    { oznaka: "primer-okretna-fotelja-luna", varijanta: "Grafit, Orah", sifra: "LUNA-GO", komada: "0", u_ponudi: "ne" },
    {
      oznaka: "primer-stolica-iva",
      naziv: "Stolica Iva",
      status: "objavljen",
      kategorije: "Nameštaj > Stolice",
      kolekcije: "Novo",
      sifra: "IVA-1",
      kratak_opis: "Bela, mat",
      opis: "Lagana stolica od oblikovane plastike sa nogama od bukve.",
      detalji: "Dimenzije: 46 × 53 × 81 cm | Održavanje: Prati blagim deterdžentom",
      cena: "7900",
      cena_na_akciji: "6700",
      tezina_g: "4200",
      na_stanju: "da",
      komada: "24",
      pri_kraju: "uvek",
      prag: "",
      slike: photo("ds-p-white.jpg"),
      slicni: "primer-okretna-fotelja-luna",
    },
    {
      oznaka: "primer-hoklica-bor",
      naziv: "Hoklica Bor",
      status: "nacrt",
      kategorije: "Nameštaj > Barske stolice",
      kratak_opis: "Masivni hrast, 65 cm",
      opis: "Niska hoklica od masivnog hrasta. Nacrt: ne vidi se na sajtu dok je ne objavite.",
      cena: "6400",
      na_stanju: "ne",
      pri_kraju: "ne",
      slike: photo("ds-p-stool.jpg"),
    },
  ];
}

/** Redovi primera za CSV: zaglavlje, pa proizvodi i varijante. */
export function exampleRows(base: string): string[][] {
  return [EXPORT_HEADER, ...rows(base).map((row) => EXPORT_HEADER.map((column) => row[column as keyof Row] ?? ""))];
}

/** Širine kolona u Excel-u: duži tekst dobija širu kolonu. */
const WIDE = new Set(["opis", "detalji", "opcije", "slike", "istaknuto_tekst", "istaknuto_mere", "seo_opis"]);

/** List „Uputstvo": kolona i šta se u nju upisuje. */
export function helpSheet(): XlsxSheet {
  return {
    name: "Uputstvo",
    header: true,
    widths: [22, 120],
    rows: [
      ["Kolona", "Šta se upisuje"],
      ...COLUMN_HELP,
      ["", ""],
      ["Redovi", "Red proizvoda nosi sve podatke proizvoda. Proizvod sa opcijama ima ispod sebe po red za svaku varijantu: ista oznaka, popunjena kolona „varijanta”, a ostale kolone samo kada se razlikuju."],
      ["Kolone", "Kolona koje nema u fajlu se ne menja kod postojećeg proizvoda, pa fajl može da ima samo kolone koje menjate (npr. oznaka, cena, komada)."],
      ["Slike", "Slike se preuzimaju sa adresa iz fajla pri uvozu. Slika koja je već u biblioteci (izvoz iz ovog panela) se ne preuzima ponovo."],
    ],
  };
}

/** Primer kao Excel: list „Proizvodi" sa primerom i list „Uputstvo". */
export function exampleSheets(base: string): XlsxSheet[] {
  return [
    {
      name: "Proizvodi",
      header: true,
      rows: exampleRows(base),
      widths: EXPORT_HEADER.map((column) => (WIDE.has(column) ? 48 : column.length > 12 ? 18 : 14)),
    },
    helpSheet(),
  ];
}
