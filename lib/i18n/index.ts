/**
 * Prevod. Tekstovi u kodu su na srpskom i ujedno su ključ: `t("Dodaj u korpu")` na srpskom
 * vraća isti tekst, a na drugom jeziku ono što piše u rečniku tog jezika. Tekst kog u rečniku
 * nema ostaje na srpskom, pa nepreveden deo ne puca nego se vidi.
 * Promenljivi delovi se pišu u vitičastim zagradama: `t("Porudžbina {broj}", { broj })`.
 * Ovaj fajl radi i na serveru i u pregledaču.
 */

export type Lang = "sr" | "en";

export const LANGS: Record<Lang, string> = { sr: "Srpski", en: "English" };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && value in LANGS;
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
          return "(.+?)";
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
  const active = dicts.map((dict) => dict?.[lang]).filter((dict): dict is Dict => dict !== undefined);
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

/** Oznaka jezika za atribut `lang` i Open Graph. */
export const htmlLang: Record<Lang, string> = { sr: "sr", en: "en" };
export const ogLocale: Record<Lang, string> = { sr: "sr_RS", en: "en_US" };
