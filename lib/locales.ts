/**
 * Izbori za Podešavanja → Opšte: jezici, zapis datuma, vremenske zone i pozivni brojevi, sa
 * nazivima koje daje Intl (ICU), umesto da vlasnik upisuje oznake kao „sr-Latn-RS" ili
 * „Europe/Belgrade". Stvarna vrednost se vidi ispod naziva.
 */

type Option = { value: string; label: string; hint: string };

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Jezik za nazive: srpski panel je na latinici, a Intl za „sr" daje ćirilicu. */
const shown = (lang: string) => (lang === "sr" ? "sr-Latn" : lang);

function displayName(type: "language" | "region", code: string, inLang: string): string {
  try {
    return new Intl.DisplayNames([shown(inLang)], { type }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Jezici koji se najčešće dodaju sajtu; panel ih nudi po nazivu. */
const SITE_LANGUAGES = [
  "en", "de", "fr", "it", "es", "pt", "nl", "pl", "cs", "sk", "sl", "hr", "bs", "mk", "bg", "ro", "hu",
  "el", "sq", "tr", "ru", "uk", "sv", "da", "no", "fi", "ar", "zh", "ja",
];

/** Jezici sajta: naziv na jeziku panela, a ispod naziv na tom jeziku i oznaka u adresi (/en). */
export function languageOptions(panelLang: string, extra: string[] = []): Option[] {
  return [...new Set([...SITE_LANGUAGES, ...extra])].map((code) => ({
    value: code,
    label: capital(displayName("language", code, panelLang)),
    hint: `${capital(displayName("language", code, code))} · /${code}`,
  }));
}

/** Zapis datuma i brojeva: naziv, a ispod primer današnjeg datuma i oznaka. */
const LOCALES = [
  "sr-Latn-RS", "sr-Cyrl-RS", "sr-Latn-ME", "hr-HR", "bs-BA", "mk-MK", "sl-SI", "bg-BG", "ro-RO", "hu-HU",
  "el-GR", "sq-AL", "de-DE", "de-AT", "de-CH", "en-GB", "en-US", "fr-FR", "it-IT", "es-ES", "pt-PT", "nl-NL",
  "pl-PL", "cs-CZ", "sk-SK", "tr-TR", "ru-RU", "uk-UA", "sv-SE", "da-DK", "nb-NO", "fi-FI",
];

export function localeOptions(panelLang: string, current: string): Option[] {
  const today = new Date();
  return [...new Set([...LOCALES, current])].flatMap((code) => {
    try {
      const sample = new Intl.DateTimeFormat(code, { dateStyle: "medium", timeStyle: "short" }).format(today);
      return [{ value: code, label: capital(displayName("language", code, panelLang)), hint: `${sample} · ${code}` }];
    } catch {
      return [];
    }
  });
}

/** Odstupanje zone od UTC u ovom trenutku, npr. „UTC+2". */
function offset(zone: string): string {
  try {
    const part = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((item) => item.type === "timeZoneName")?.value;
    return (part ?? "GMT").replace("GMT", "UTC");
  } catch {
    return "UTC";
  }
}

/** Naziv vremena u zoni na jeziku panela, npr. „srednjeevropsko vreme". */
function zoneName(zone: string, panelLang: string): string {
  try {
    return (
      new Intl.DateTimeFormat(shown(panelLang), { timeZone: zone, timeZoneName: "longGeneric" })
        .formatToParts(new Date())
        .find((item) => item.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
}

/**
 * Sve vremenske zone: grad iz oznake zone (engleski naziv, npr. Belgrade), a ispod naziv
 * vremena, odstupanje od UTC i oznaka. Pretraga gleda i naziv vremena.
 */
export function timeZoneOptions(current: string, panelLang = "sr"): Option[] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [current];
  return [...new Set([current, ...zones])].map((zone) => {
    const city = zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
    const name = zoneName(zone, panelLang);
    return { value: zone, label: city, hint: [name, offset(zone), zone].filter(Boolean).join(" · ") };
  });
}

/** Zemlje sa pozivnim brojem; kupac iz iste zemlje se prepoznaje i kada broj upiše bez njega. */
const DIAL_CODES: [string, string][] = [
  ["RS", "381"], ["ME", "382"], ["BA", "387"], ["HR", "385"], ["MK", "389"], ["SI", "386"],
  ["AL", "355"], ["BG", "359"], ["RO", "40"], ["HU", "36"], ["GR", "30"], ["AT", "43"], ["DE", "49"],
  ["CH", "41"], ["IT", "39"], ["FR", "33"], ["ES", "34"], ["PT", "351"], ["NL", "31"], ["BE", "32"],
  ["LU", "352"], ["GB", "44"], ["IE", "353"], ["DK", "45"], ["SE", "46"], ["NO", "47"], ["FI", "358"],
  ["PL", "48"], ["CZ", "420"], ["SK", "421"], ["UA", "380"], ["TR", "90"], ["CY", "357"], ["MT", "356"],
  ["US", "1"], ["AU", "61"], ["AE", "971"],
];

export function dialCodeOptions(panelLang: string, current: string): Option[] {
  const options = DIAL_CODES.map(([region, code]) => ({ value: code, label: displayName("region", region, panelLang), hint: `+${code}` }));
  // Broj koji nije na spisku ostaje izbor, da se sačuvana vrednost ne izgubi.
  return current && !options.some((option) => option.value === current)
    ? [{ value: current, label: `+${current}`, hint: `+${current}` }, ...options]
    : options;
}

/**
 * Valute: naziv, a ispod kako iznos izgleda. Vrednost je oznaka koja stoji uz iznos (RSD, €…);
 * oznaka koja nije na spisku ostaje izbor, da se sačuvana vrednost ne izgubi.
 */
const CURRENCIES: [string, string][] = [
  ["RSD", "RSD"], ["EUR", "€"], ["EUR", "EUR"], ["BAM", "KM"], ["MKD", "MKD"], ["HUF", "Ft"], ["RON", "lei"],
  ["BGN", "лв"], ["CHF", "CHF"], ["GBP", "£"], ["USD", "$"], ["CZK", "Kč"], ["PLN", "zł"], ["SEK", "kr"],
  ["NOK", "kr"], ["DKK", "kr"], ["TRY", "₺"],
];

export function currencyOptions(panelLang: string, current: string): Option[] {
  const options = CURRENCIES.map(([iso, label]) => {
    let name = iso;
    try {
      name = new Intl.DisplayNames([shown(panelLang)], { type: "currency" }).of(iso) ?? iso;
    } catch {}
    return { value: label, label: capital(name), hint: `1.250 ${label} · ${iso}` };
  }).filter((option, index, all) => all.findIndex((other) => other.value === option.value) === index);
  return current && !options.some((option) => option.value === current)
    ? [{ value: current, label: current, hint: `1.250 ${current}` }, ...options]
    : options;
}
