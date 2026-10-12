/**
 * Prevod. Tekstovi u kodu su na srpskom i ujedno su ključ: `t("Dodaj u korpu")` na srpskom
 * vraća isti tekst, a na drugom jeziku ono što piše u rečniku tog jezika. Tekst kog u rečniku
 * nema ostaje na srpskom, pa nepreveden deo ne puca nego se vidi.
 * Promenljivi delovi se pišu u vitičastim zagradama: `t("Porudžbina {broj}", { broj })`.
 * Ovaj fajl radi i na serveru i u pregledaču.
 */

/** Oznaka jezika: "sr", "en", "de", "pt-br"… Prodavnica može imati koliko god jezika. */
export type Lang = string;

/** Jezici za koje rečnik postoji u kodu. Panel radi samo na njima; prodavnica i na jezicima koje vlasnik prevede. */
export const LANGS: Record<string, string> = { sr: "Srpski", en: "English" };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && value in LANGS;
}

/** Oznaka jezika u obliku koji se koristi u adresi: dva slova, po želji sa oznakom zemlje ("pt-br"). */
export function langCode(value: unknown): Lang | null {
  const code = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z]{2}(-[a-z]{2,4})?$/.test(code) ? code : null;
}

/** Naziv jezika na tom jeziku ("Deutsch", "Français"), za izbor jezika na sajtu. */
export function langName(code: Lang): string {
  if (LANGS[code]) return LANGS[code];
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name && name !== code ? name.charAt(0).toUpperCase() + name.slice(1) : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** Rečnik jednog jezika: srpski tekst → prevod. */
export type Dict = Record<string, string>;

export type Vars = Record<string, string | number>;
export type T = (text: string, vars?: Vars) => string;

function fill(text: string, vars?: Vars): string {
  return vars ? text.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole)) : text;
}

type Pattern = { test: RegExp; names: string[]; out: string };

/** Ključevi sa {…}, kao obrasci: „Još samo {n} kom." hvata i „Još samo 3 kom.". */
function patterns(dict: Dict): Pattern[] {
  return Object.entries(dict)
    .filter(([key]) => key.includes("{"))
    .map(([key, out]) => {
      const names: string[] = [];
      const source = key
        .split(/(\{\w+\})/)
        .map((part) => {
          const name = /^\{(\w+)\}$/.exec(part)?.[1];
          if (!name) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          names.push(name);
          // {n} hvata samo broj, da „{n} proizvoda" ne zahvati naslov koji se tako završava.
          return name === "n" ? "(\\d[\\d.,]*)" : "(.+?)";
        })
        .join("");
      return { test: new RegExp(`^${source}$`, "s"), names, out };
    });
}

/**
 * Funkcija prevoda za dati jezik; kasniji rečnik ima prednost nad ranijim.
 * Tekst koji stigne sa već upisanim vrednostima (poruka sa servera) prevodi se po obrascu.
 */
export function makeT(lang: Lang, ...dicts: (Partial<Record<Lang, Dict>> | undefined)[]): T {
  // Jezik bez rečnika u kodu (npr. nemački) dok ga vlasnik ne prevede pada na engleski, ne na srpski.
  const active = dicts
    .map((dict) => dict?.[lang] ?? (lang === "sr" ? undefined : dict?.en))
    .filter((dict): dict is Dict => dict !== undefined);
  if (active.length === 0) return fill;
  const byPattern = active.flatMap(patterns);
  const seen = new Map<string, string>();
  return (text, vars) => {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      const found = active[index][text];
      if (found !== undefined) return fill(found, vars);
    }
    if (vars || text === "") return fill(text, vars);
    const cached = seen.get(text);
    if (cached !== undefined) return cached;
    let out = text;
    for (const pattern of byPattern) {
      const match = pattern.test.exec(text);
      if (!match) continue;
      out = fill(pattern.out, Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1]])));
      break;
    }
    if (seen.size < 2000) seen.set(text, out);
    return out;
  };
}

/** Oznaka jezika za Open Graph: "sr" → "sr_RS", "pt-br" → "pt_BR". */
export function ogLocale(lang: Lang): string {
  const known: Record<string, string> = { sr: "sr_RS", en: "en_US" };
  const [language, region] = lang.split("-");
  return known[lang] ?? (region ? `${language}_${region.toUpperCase()}` : `${language}_${language.toUpperCase()}`);
}
