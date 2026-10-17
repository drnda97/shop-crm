import { isLang, langCode, type Lang } from "@/lib/i18n";
import type { Currency } from "@/lib/format";
import { legacyMethods, normalizeMethods, type ShippingMethod } from "@/lib/shipping";
import { defaultSite, mergeSite, type SiteSettings } from "@/lib/site";
import { mergeTemplates, type Templates } from "@/lib/templates";
import {
  defaultColors,
  defaultFonts,
  isFontId,
  isHexColor,
  type ThemeColors,
  type ThemeFonts,
} from "@/lib/theme";

export { colorLabels, defaultColors, isHexColor, type ThemeColors } from "@/lib/theme";

/**
 * Podešavanja prodavnice koja se menjaju u admin panelu. Ovde su tipovi i
 * početne vrednosti; sačuvane vrednosti su u bazi (tabela settings).
 */

export type StoreSettings = {
  name: string;
  phone: string;
  email: string;
  address: string;
  /** Oznaka valute uz iznose, npr. "RSD" ili "€". */
  currency: string;
  /** 0: iznosi su celi (RSD); 2: iznosi imaju dve decimale (EUR). */
  currencyDecimals: 0 | 2;
  /** Jezik sajta i poruka kupcima, i jezik panela (lib/i18n). */
  language: Lang;
  /** Ostali jezici sajta, koje kupac bira na sajtu (adresa dobija /en, /de…). Prevodi su u panelu, deo Prevodi. */
  languages: Lang[];
  panelLanguage: Lang;
  /** Jezik i zemlja za zapis datuma, npr. "sr-Latn-RS". */
  locale: string;
  /** Vremenska zona za datume i statistiku po danima, npr. "Europe/Belgrade". */
  timeZone: string;
  /** Pozivni broj zemlje bez plusa: isti kupac se prepoznaje i kao 064… i kao +38164… */
  phonePrefix: string;
  /** Početak nasumičnih kodova za popust, npr. "KOD" → KOD-7K3Q9X. */
  codePrefix: string;
  /** Adresa prodavnice (sajta za kupce); link „Otvori sajt" u panelu. */
  storefrontUrl: string;
  /** Sajtovi koji smeju da zovu API iz pregledača, jedan po redu. Prazno: svi. */
  allowedOrigins: string;
  /** Podaci firme za račun, kao tekst (sastavlja se od `company`); ide na račun u PDF-u i u API. */
  legal: string;
  /** Podaci firme po poljima, kako se upisuju u panelu (Porez i račun). */
  company: CompanyDetails;
};

/** Podaci firme za račun. Prazno polje se ne ispisuje. */
export type CompanyDetails = { name: string; address: string; pib: string; mb: string; account: string };

/** Podaci za uplatu na račun, po poljima (Plaćanje); kupac ih vidi uz iznos i poziv na broj. */
export type BankDetails = { recipient: string; account: string; bank: string; purpose: string; note: string };

const emptyCompany: CompanyDetails = { name: "", address: "", pib: "", mb: "", account: "" };
const emptyBank: BankDetails = { recipient: "", account: "", bank: "", purpose: "", note: "" };

/** Podaci firme kao redovi teksta za račun: naziv, adresa, pa PIB, matični broj i račun sa nazivom. */
export function legalText(company: CompanyDetails): string {
  return [
    company.name,
    company.address,
    company.pib && `PIB: ${company.pib}`,
    company.mb && `Matični broj: ${company.mb}`,
    company.account && `Tekući račun: ${company.account}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Podaci za uplatu kao tekst za kupca (stranica posle porudžbine, email, API). */
export function bankText(details: BankDetails): string {
  return [
    details.recipient && `Primalac: ${details.recipient}`,
    details.account && `Račun: ${details.account}`,
    details.bank && `Banka: ${details.bank}`,
    details.purpose && `Svrha uplate: ${details.purpose}`,
    details.note,
  ]
    .filter(Boolean)
    .join("\n");
}

const field = (line: string, label: RegExp) => line.replace(label, "").trim();

/** Podaci firme iz teksta ranije verzije (jedno polje): PIB, matični broj i račun po nazivu, ostali redovi su naziv i adresa. */
export function companyFromLegal(legal: string): CompanyDetails {
  const company = { ...emptyCompany };
  const rest: string[] = [];
  for (const line of legal.split("\n").map((item) => item.trim()).filter(Boolean)) {
    if (/^PIB\b/i.test(line)) company.pib = field(line, /^PIB[:\s]*/i);
    else if (/^mati[čc]ni broj/i.test(line)) company.mb = field(line, /^mati[čc]ni broj[:\s]*/i);
    else if (/ra[čc]un/i.test(line)) company.account = field(line, /^.*?ra[čc]un[:\s]*/i);
    else rest.push(line);
  }
  company.name = rest[0] ?? "";
  company.address = rest.slice(1).join(", ");
  return company;
}

/** Podaci za uplatu iz teksta ranije verzije; red „Poziv na broj" se izostavlja (dodaje se sam, sa brojem porudžbine). */
export function bankFromText(text: string): BankDetails {
  const details = { ...emptyBank };
  const rest: string[] = [];
  for (const line of text.split("\n").map((item) => item.trim()).filter(Boolean)) {
    if (/^primalac/i.test(line)) details.recipient = field(line, /^primalac[:\s]*/i);
    else if (/^(broj )?ra[čc]un/i.test(line)) details.account = field(line, /^(broj )?ra[čc]un[a]?[:\s]*/i);
    else if (/^banka/i.test(line)) details.bank = field(line, /^banka[:\s]*/i);
    else if (/^svrha/i.test(line)) details.purpose = field(line, /^svrha( uplate)?[:\s]*/i);
    else if (!/^poziv na broj/i.test(line)) rest.push(line);
  }
  details.note = rest.join(" ");
  return details;
}

function textFields<T extends Record<string, string>>(empty: T, value: unknown, max = 255): T {
  const source = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(empty).map((key) => [key, typeof source[key] === "string" ? (source[key] as string).trim().slice(0, max) : ""]),
  ) as T;
}

/** Podaci firme iz zapisa; zapis bez njih (ranija verzija) ih dobija iz teksta `legal`. */
export function companyOf(store: Partial<StoreSettings> | undefined): CompanyDetails {
  const saved = textFields(emptyCompany, store?.company);
  return Object.values(saved).some(Boolean) ? saved : companyFromLegal(store?.legal ?? "");
}

/** Podaci za uplatu iz zapisa; zapis bez njih (ranija verzija) ih dobija iz teksta `bankInstructions`. */
export function bankDetailsOf(payment: Partial<PaymentSettings> | undefined): BankDetails {
  const saved = textFields(emptyBank, payment?.bankDetails, 500);
  return Object.values(saved).some(Boolean) ? saved : bankFromText(payment?.bankInstructions ?? "");
}

export type ShippingSettings = {
  /** Načini dostave koje kupac bira pri poručivanju (lib/shipping.ts). Uvek postoji bar jedan. */
  methods: ShippingMethod[];
};

export type PaymentMethod = "cod" | "bank" | "card";

export const paymentLabels: Record<PaymentMethod, string> = {
  cod: "Plaćanje pouzećem",
  bank: "Uplata na račun",
  card: "Plaćanje karticom",
};

export type PaymentSettings = {
  cod: boolean;
  bank: boolean;
  /** Podaci za uplatu kao tekst (sastavlja se od `bankDetails`); kupac ih dobija posle porudžbine, uz iznos i poziv na broj. */
  bankInstructions: string;
  bankDetails: BankDetails;
  /**
   * Plaćanje karticom. Radi samo uz povezan procesor (lib/payments.ts): bez njega se ne nudi
   * kupcu, i kada je uključeno.
   */
  card: boolean;
  /** Id procesora kartica koji prodavnica koristi; prazno: nijedan. */
  cardProvider: string;
  /** Kupac može da zatraži povrat sa stranice za praćenje porudžbine. Isključeno: prodavnica ne radi povrat. */
  returns: boolean;
};

export type TaxSettings = {
  /** Prodavnica je u sistemu PDV-a: na računu se iskazuju osnovica i PDV. */
  enabled: boolean;
  /** Stopa u procentima. Cene u prodavnici već sadrže PDV. */
  percent: number;
  /** Kada kupac dobija račun u PDF-u u prilogu emaila: nikad, uz potvrdu porudžbine, ili kada je poslata. */
  invoiceEmail: InvoiceEmail;
};

export const INVOICE_EMAILS = ["none", "order", "shipped"] as const;
export type InvoiceEmail = (typeof INVOICE_EMAILS)[number];

export type AnalyticsSettings = {
  /** Google Analytics 4: oznaka merenja, „G-XXXXXXXXXX". Prazno: isključeno. */
  ga4: string;
  /** Meta (Facebook) Pixel ID: broj. Prazno: isključeno. */
  metaPixel: string;
};

/** Prijava kupaca preko spoljnog naloga. Svaka prodavnica upisuje sopstvene podatke iz Google Cloud konzole. */
export type AuthSettings = {
  /** OAuth Client ID; dugme „Nastavi sa Google nalogom" se prikazuje tek kada su upisani i ID i tajna. */
  googleClientId: string;
  googleClientSecret: string;
};

export function googleLoginReady(settings: Settings): boolean {
  return settings.auth.googleClientId !== "" && settings.auth.googleClientSecret !== "";
}

/**
 * Pristup spolja. Sve je isključeno dok vlasnik izričito ne uključi: bez toga niko van ove
 * aplikacije ne može da čita podatke prodavnice niti da ih dobija. Gotova prodavnica uz panel
 * radi i kada je sve isključeno, jer čita bazu direktno.
 */
export type AccessSettings = {
  /** Javni API (/api/v1/…): katalog, stranice, obračun korpe i slanje porudžbine za sajt van ove aplikacije. */
  publicApi: boolean;
  /** API sa ključem (/api/v1/admin/…): porudžbine i stanje za spoljne sisteme. */
  adminApi: boolean;
  /** Slanje webhook-ova. */
  webhooks: boolean;
};

export type AbandonedCartSettings = {
  /** Podsetnik kupcu koji je upisao email na stranici plaćanja, a nije poručio. Isključeno dok vlasnik ne odluči. */
  enabled: boolean;
  /** Posle koliko sati bez porudžbine se šalje (jedan podsetnik po korpi). */
  delayHours: number;
  subject: string;
  /** {ime} i {prodavnica} se menjaju podacima; ispod teksta idu proizvodi iz korpe i link za povratak. */
  text: string;
};

export const defaultAbandoned: AbandonedCartSettings = {
  enabled: false,
  delayHours: 3,
  subject: "Vaša korpa vas čeka",
  text: "Zdravo {ime}, ostavili ste proizvode u korpi. Sačuvali smo ih, pa porudžbinu možete da završite jednim klikom.",
};

/** Statusi o kojima kupac može da dobije email. */
/** „refunded" nije status porudžbine: poruka ide kada se upiše povraćaj novca. */
export const STATUS_EMAILS = ["confirmed", "shipped", "delivered", "cancelled", "refunded"] as const;
export type StatusEmailKey = (typeof STATUS_EMAILS)[number];

export type StatusEmail = {
  enabled: boolean;
  subject: string;
  /** Tekst poruke. {broj}, {ime}, {pracenje}, {iznos} (kod povraćaja) i {prodavnica} se menjaju podacima porudžbine. */
  text: string;
};

export const defaultStatusEmails: Record<StatusEmailKey, StatusEmail> = {
  confirmed: {
    enabled: false,
    subject: "Porudžbina #{broj} je potvrđena",
    text: "Zdravo {ime}, potvrdili smo vašu porudžbinu i pripremamo je za slanje.",
  },
  shipped: {
    enabled: true,
    subject: "Porudžbina #{broj} je poslata",
    text: "Zdravo {ime}, vaša porudžbina je predata na dostavu. {pracenje}",
  },
  delivered: {
    enabled: false,
    subject: "Porudžbina #{broj} je isporučena",
    text: "Zdravo {ime}, vaša porudžbina je isporučena. Hvala što kupujete kod nas.",
  },
  cancelled: {
    enabled: true,
    subject: "Porudžbina #{broj} je otkazana",
    text: "Zdravo {ime}, vaša porudžbina je otkazana. Ako to niste očekivali, javite nam se.",
  },
  refunded: {
    enabled: true,
    subject: "Povraćaj za porudžbinu #{broj}",
    text: "Zdravo {ime}, vraćamo vam {iznos} za porudžbinu #{broj}. Novac stiže na isti način na koji je porudžbina plaćena.",
  },
};

export const statusEmailLabels: Record<StatusEmailKey, string> = {
  confirmed: "kada porudžbina postane potvrđena",
  shipped: "kada porudžbina postane poslata",
  delivered: "kada porudžbina postane isporučena",
  cancelled: "kada je porudžbina otkazana",
  refunded: "kada upišete povraćaj novca",
};

export type MailSettings = {
  /** Email prodavcu za svaku novu porudžbinu. */
  notifySeller: boolean;
  /** Potvrda kupcu. */
  notifyCustomer: boolean;
  /** Adresa na koju stižu porudžbine. */
  sellerEmail: string;
  fromName: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  /** true: koristi se šablon koji je vlasnik ubacio. */
  customTemplate: boolean;
  /** Poruke kupcu kada porudžbina promeni status. */
  statusEmails: Record<StatusEmailKey, StatusEmail>;
};

export type Settings = {
  store: StoreSettings;
  /** Tema iz koda (themes/list.ts) na kojoj je aktivna tema; ostalo o temi je u lib/theme-packages.ts. */
  themeId: string;
  /** Sopstveni CSS aktivne teme, posle stilova teme iz koda (Izgled sajta → Boje i fontovi). */
  customCss: string;
  /** Boje sajta i emaila, i fontovi sajta (lib/theme.ts). */
  colors: ThemeColors;
  fonts: ThemeFonts;
  logo?: string;
  favicon?: string;
  /** Meni, podnožje i traka sa obaveštenjem (lib/site.ts). */
  site: SiteSettings;
  /** Tekstovi i fotografije stranica sa stalnim rasporedom (lib/templates.ts). */
  templates: Templates;
  shipping: ShippingSettings;
  payment: PaymentSettings;
  tax: TaxSettings;
  abandoned: AbandonedCartSettings;
  /** Merenje poseta; učitava se samo uz pristanak posetioca (traka za kolačiće). */
  analytics: AnalyticsSettings;
  auth: AuthSettings;
  access: AccessSettings;
  mail: MailSettings;
  panel: PanelSettings;
};

/** Izgled panela. */
export type PanelSettings = {
  /** Koliko proizvoda staje na jednu stranu spiska u panelu (Proizvodi). */
  productsPerPage: number;
};

export const PRODUCTS_PER_PAGE = { default: 20, min: 5, max: 200 };

/** Broj proizvoda po strani u granicama; neispravan je podrazumevani. */
export function productsPerPage(value: unknown): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0
    ? Math.min(Math.max(number, PRODUCTS_PER_PAGE.min), PRODUCTS_PER_PAGE.max)
    : PRODUCTS_PER_PAGE.default;
}

export const defaultSettings: Settings = {
  store: {
    name: "Moja prodavnica",
    phone: "",
    email: "",
    address: "",
    currency: "RSD",
    currencyDecimals: 0,
    language: "sr",
    languages: [],
    panelLanguage: "sr",
    locale: "sr-Latn-RS",
    timeZone: "Europe/Belgrade",
    phonePrefix: "381",
    codePrefix: "KOD",
    storefrontUrl: "",
    allowedOrigins: "",
    legal: "",
    company: emptyCompany,
  },
  themeId: "default",
  customCss: "",
  colors: defaultColors,
  fonts: defaultFonts,
  site: defaultSite,
  templates: mergeTemplates(undefined),
  shipping: { methods: legacyMethods({}) },
  payment: { cod: true, bank: false, bankInstructions: "", bankDetails: emptyBank, card: false, cardProvider: "", returns: true },
  tax: { enabled: false, percent: 20, invoiceEmail: "none" },
  abandoned: defaultAbandoned,
  analytics: { ga4: "", metaPixel: "" },
  auth: { googleClientId: "", googleClientSecret: "" },
  access: { publicApi: false, adminApi: false, webhooks: false },
  panel: { productsPerPage: PRODUCTS_PER_PAGE.default },
  mail: {
    notifySeller: true,
    notifyCustomer: true,
    sellerEmail: "",
    fromName: "",
    fromEmail: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    customTemplate: false,
    statusEmails: defaultStatusEmails,
  },
};

function mergeColors(saved: Partial<ThemeColors> | undefined): ThemeColors {
  const colors = { ...defaultColors };
  for (const key of Object.keys(colors) as (keyof ThemeColors)[]) {
    const value = saved?.[key];
    if (isHexColor(value)) colors[key] = value.toLowerCase();
  }
  return colors;
}

/**
 * Načini dostave iz zapisa. Zapis iz prve verzije (jedna cena, prag, preuzimanje) se prevodi
 * u načine dostave, sa nazivima koji su tada bili među tekstovima stranice plaćanja.
 */
function mergeShipping(saved: Partial<Settings>): ShippingMethod[] {
  const shipping = (saved.shipping ?? {}) as Record<string, unknown>;
  const methods = Array.isArray(shipping.methods)
    ? normalizeMethods(shipping.methods)
    : legacyMethods(shipping, (saved.templates as Record<string, Record<string, string>> | undefined)?.checkout);
  return methods.length > 0 ? methods : legacyMethods({});
}

/** Dodatni jezici sajta: ispravne oznake, bez ponavljanja i bez glavnog jezika; najviše 30. */
export function storeLanguages(value: unknown, main: Lang): Lang[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,;]+/) : [];
  const codes = list.map(langCode).filter((code): code is Lang => code !== null && code !== main);
  return [...new Set(codes)].slice(0, 30);
}

/** Spajanje sa početnim vrednostima, da podešavanje dodato kasnije ne fali u starom zapisu. */
export function mergeSettings(saved: Partial<Settings>): Settings {
  return {
    ...defaultSettings,
    ...saved,
    store: {
      ...defaultSettings.store,
      ...saved.store,
      language: langCode(saved.store?.language) ?? "sr",
      languages: storeLanguages(saved.store?.languages, langCode(saved.store?.language) ?? "sr"),
      panelLanguage: isLang(saved.store?.panelLanguage) ? saved.store.panelLanguage : "sr",
      company: companyOf(saved.store),
    },
    colors: mergeColors(saved.colors),
    fonts: {
      display: isFontId(saved.fonts?.display) ? saved.fonts.display : defaultFonts.display,
      body: isFontId(saved.fonts?.body) ? saved.fonts.body : defaultFonts.body,
    },
    site: mergeSite(saved.site),
    templates: mergeTemplates(saved.templates),
    shipping: { methods: mergeShipping(saved) },
    payment: { ...defaultSettings.payment, ...saved.payment, bankDetails: bankDetailsOf(saved.payment) },
    tax: {
      enabled: saved.tax?.enabled === true,
      percent: Number.isFinite(saved.tax?.percent) ? Math.min(Math.max(Number(saved.tax?.percent), 0), 100) : 20,
      invoiceEmail: INVOICE_EMAILS.find((value) => value === saved.tax?.invoiceEmail) ?? "none",
    },
    analytics: {
      ga4: /^G-[A-Z0-9]{4,20}$/.test(saved.analytics?.ga4 ?? "") ? (saved.analytics?.ga4 as string) : "",
      metaPixel: /^\d{5,20}$/.test(saved.analytics?.metaPixel ?? "") ? (saved.analytics?.metaPixel as string) : "",
    },
    auth: { ...defaultSettings.auth, ...saved.auth },
    access: {
      publicApi: saved.access?.publicApi === true,
      adminApi: saved.access?.adminApi === true,
      webhooks: saved.access?.webhooks === true,
    },
    abandoned: {
      ...defaultAbandoned,
      ...saved.abandoned,
      delayHours: Math.min(Math.max(Math.round(Number(saved.abandoned?.delayHours) || defaultAbandoned.delayHours), 1), 168),
    },
    mail: {
      ...defaultSettings.mail,
      ...saved.mail,
      statusEmails: Object.fromEntries(
        STATUS_EMAILS.map((key) => [key, { ...defaultStatusEmails[key], ...saved.mail?.statusEmails?.[key] }]),
      ) as Record<StatusEmailKey, StatusEmail>,
    },
    panel: { productsPerPage: productsPerPage(saved.panel?.productsPerPage) },
    customCss: safeCss(saved.customCss),
  };
}

/** Najviše znakova sopstvenog CSS-a teme. */
export const MAX_CUSTOM_CSS = 200_000;

/** Sopstveni CSS koji sme na stranicu: tekst, bez zatvaranja <style> oznake, do MAX_CUSTOM_CSS. */
export function safeCss(value: unknown): string {
  return typeof value === "string" ? value.replace(/<\/style/gi, "<\\/style").slice(0, MAX_CUSTOM_CSS) : "";
}

export function currencyOf(settings: Settings): Currency {
  return { code: settings.store.currency, decimals: settings.store.currencyDecimals };
}

/**
 * Uključeni načini plaćanja; ako nijedan nije uključen, ostaje pouzeće. Kartica se nudi samo
 * kada je `cardReady` — kada je izabrani procesor zaista povezan (lib/payments.ts).
 */
export function enabledPayments(settings: Settings, cardReady = false): PaymentMethod[] {
  const methods = (["cod", "bank"] as PaymentMethod[]).filter((method) => settings.payment[method as "cod" | "bank"]);
  if (settings.payment.card && cardReady) methods.push("card");
  return methods.length > 0 ? methods : ["cod"];
}

/**
 * Sajtovi koji smeju da zovu API iz pregledača (CORS): upisani u panelu, plus adresa sajta
 * prodavnice. Prazno znači da API iz pregledača sme da zove samo isti sajt, nijedan drugi.
 */
export function allowedOrigins(store: StoreSettings): string[] {
  const listed = store.allowedOrigins
    .split(/[\s,]+/)
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  let own: string[] = [];
  try {
    if (store.storefrontUrl) own = [new URL(store.storefrontUrl).origin];
  } catch {
    own = [];
  }
  return [...new Set([...listed, ...own])];
}
