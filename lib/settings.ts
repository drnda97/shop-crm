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
  /** Podaci firme za račun: pun naziv, sedište, PIB, matični broj, tekući račun. */
  legal: string;
};

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
  /** Podaci za uplatu (primalac, račun, poziv na broj); kupac ih dobija posle porudžbine. */
  bankInstructions: string;
  /**
   * Plaćanje karticom. Radi samo uz povezan procesor (lib/payments.ts): bez njega se ne nudi
   * kupcu, i kada je uključeno.
   */
  card: boolean;
  /** Id procesora kartica koji prodavnica koristi; prazno: nijedan. */
  cardProvider: string;
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
  mail: MailSettings;
};

export const defaultSettings: Settings = {
  store: {
    name: "Moja prodavnica",
    phone: "",
    email: "",
    address: "",
    currency: "RSD",
    currencyDecimals: 0,
    locale: "sr-Latn-RS",
    timeZone: "Europe/Belgrade",
    phonePrefix: "381",
    codePrefix: "KOD",
    storefrontUrl: "",
    allowedOrigins: "",
    legal: "",
  },
  colors: defaultColors,
  fonts: defaultFonts,
  site: defaultSite,
  templates: mergeTemplates(undefined),
  shipping: { methods: legacyMethods({}) },
  payment: { cod: true, bank: false, bankInstructions: "", card: false, cardProvider: "" },
  tax: { enabled: false, percent: 20, invoiceEmail: "none" },
  abandoned: defaultAbandoned,
  analytics: { ga4: "", metaPixel: "" },
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

/** Spajanje sa početnim vrednostima, da podešavanje dodato kasnije ne fali u starom zapisu. */
export function mergeSettings(saved: Partial<Settings>): Settings {
  return {
    ...defaultSettings,
    ...saved,
    store: { ...defaultSettings.store, ...saved.store },
    colors: mergeColors(saved.colors),
    fonts: {
      display: isFontId(saved.fonts?.display) ? saved.fonts.display : defaultFonts.display,
      body: isFontId(saved.fonts?.body) ? saved.fonts.body : defaultFonts.body,
    },
    site: mergeSite(saved.site),
    templates: mergeTemplates(saved.templates),
    shipping: { methods: mergeShipping(saved) },
    payment: { ...defaultSettings.payment, ...saved.payment },
    tax: {
      enabled: saved.tax?.enabled === true,
      percent: Number.isFinite(saved.tax?.percent) ? Math.min(Math.max(Number(saved.tax?.percent), 0), 100) : 20,
      invoiceEmail: INVOICE_EMAILS.find((value) => value === saved.tax?.invoiceEmail) ?? "none",
    },
    analytics: {
      ga4: /^G-[A-Z0-9]{4,20}$/.test(saved.analytics?.ga4 ?? "") ? (saved.analytics?.ga4 as string) : "",
      metaPixel: /^\d{5,20}$/.test(saved.analytics?.metaPixel ?? "") ? (saved.analytics?.metaPixel as string) : "",
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
  };
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

export function allowedOrigins(store: StoreSettings): string[] {
  return store.allowedOrigins
    .split(/[\s,]+/)
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}
