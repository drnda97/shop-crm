import type { Currency } from "@/lib/format";
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
};

export type ShippingSettings = {
  /** Cena dostave, u najmanjim jedinicama valute. */
  price: number;
  /** Besplatna dostava za veće porudžbine; dok je isključeno, dostava se uvek naplaćuje. */
  freeEnabled: boolean;
  /** Vrednost proizvoda (posle popusta) od koje je dostava besplatna. */
  freeFrom: number;
  /** Kupac može da izabere preuzimanje u salonu; tada se dostava ne naplaćuje. */
  pickupEnabled: boolean;
};

export type PaymentMethod = "cod" | "bank";

export const paymentLabels: Record<PaymentMethod, string> = {
  cod: "Plaćanje pouzećem",
  bank: "Uplata na račun",
};

export type PaymentSettings = {
  cod: boolean;
  bank: boolean;
  /** Podaci za uplatu (primalac, račun, poziv na broj); kupac ih dobija posle porudžbine. */
  bankInstructions: string;
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
  },
  colors: defaultColors,
  fonts: defaultFonts,
  site: defaultSite,
  templates: mergeTemplates(undefined),
  shipping: { price: 0, freeEnabled: false, freeFrom: 0, pickupEnabled: false },
  payment: { cod: true, bank: false, bankInstructions: "" },
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
    shipping: { ...defaultSettings.shipping, ...saved.shipping },
    payment: { ...defaultSettings.payment, ...saved.payment },
    mail: { ...defaultSettings.mail, ...saved.mail },
  };
}

export function currencyOf(settings: Settings): Currency {
  return { code: settings.store.currency, decimals: settings.store.currencyDecimals };
}

/** Uključeni načini plaćanja; ako nijedan nije uključen, ostaje pouzeće. */
export function enabledPayments(settings: Settings): PaymentMethod[] {
  const methods = (["cod", "bank"] as const).filter((method) => settings.payment[method]);
  return methods.length > 0 ? methods : ["cod"];
}

export function allowedOrigins(store: StoreSettings): string[] {
  return store.allowedOrigins
    .split(/[\s,]+/)
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}
