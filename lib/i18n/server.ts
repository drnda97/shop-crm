import { headers } from "next/headers";
import { cache } from "react";
import { getSettings } from "@/lib/content";
import { makeT, type Dict, type Lang, type T } from "@/lib/i18n";
import { contentMap } from "@/lib/i18n/content";
import { panelDict } from "@/lib/i18n/panel";
import { shopDict } from "@/lib/i18n/shop";
import { translateDeep } from "@/lib/i18n/walk";
import { langPrefix, localPath } from "@/lib/routes";
import { LANG_HEADER } from "@/lib/storefront/preview-names";
import { getTranslations } from "@/lib/translations";
import { getTheme } from "@/themes/pages";

/**
 * Prevod na serveru. Prodavnica ima glavni jezik i, po želji, dodatne koje kupac bira na
 * sajtu (adresa tada počinje sa /en, /de…); panel ima svoj jezik, srpski ili engleski.
 */

/** Jezik stranice koju kupac gleda: sa početka adrese ako ga prodavnica ima, inače glavni. */
export const getShopLang = cache(async (): Promise<Lang> => {
  const { language, languages } = (await getSettings()).store;
  let asked: string | null = null;
  try {
    asked = (await headers()).get(LANG_HEADER);
  } catch {
    // Van zahteva (raspored, skripta) nema zaglavlja.
  }
  return asked && languages.includes(asked) ? asked : language;
});

/** Jezik koji je tražen u adresi, a prodavnica ga nema: stranica tada ne postoji. */
export async function unknownShopLang(): Promise<boolean> {
  const asked = (await headers()).get(LANG_HEADER);
  if (!asked) return false;
  const { language, languages } = (await getSettings()).store;
  // Glavni jezik nema početak u adresi, pa ni /sr/… ne postoji kada je srpski glavni.
  return asked === language || !languages.includes(asked);
}

export const getPanelLang = cache(async (): Promise<Lang> => (await getSettings()).store.panelLanguage);

/** Prevod poruka kupcu na dati jezik: rečnici iz koda, pa prevodi upisani u panelu. */
export async function shopT(lang: Lang): Promise<T> {
  // Srpski je izvorni tekst, pa mu rečnik teme ne treba (i ne čita se koja je tema izabrana).
  const [themeDict, own] = await Promise.all([lang === "sr" ? {} : getTheme().then((theme) => theme.dict), getTranslations(lang)]);
  return makeT(lang, shopDict, themeDict, { [lang]: own });
}

/** Za stranice teme i poruke koje vidi kupac. */
export const getShopT = cache(async (): Promise<T> => shopT(await getShopLang()));

/** Prevodi upisani u panelu za jezik stranice; idu i komponentama teme u pregledaču. */
export async function getShopCustomDict(): Promise<Dict> {
  return getTranslations(await getShopLang());
}

/** Za panel. Panel prikazuje i nazive iz jezgra (statusi, načini plaćanja), pa uzima i taj rečnik. */
export const getPanelT = cache(async (): Promise<T> => makeT(await getPanelLang(), shopDict, panelDict));

/** Početak adrese za jezik stranice ("" za glavni jezik, inače "/en"). */
export const getShopPrefix = cache(async (): Promise<string> => langPrefix(await getShopLang(), (await getSettings()).store.language));

/** Adrese stranica prodavnice na jeziku stranice: `const to = await getShopPath(); to("/kolekcija")`. */
export const getShopPath = cache(async (): Promise<(href: string) => string> => {
  const [lang, prefix] = await Promise.all([getShopLang(), getShopPrefix()]);
  return (href) => localPath(lang, href, prefix);
});

/** Izvorni tekst → prevod za jezik stranice; prazno kada kupac gleda glavni jezik. */
const getContentWords = cache(async (): Promise<Map<string, string>> => contentWords(await getShopLang()));

/** Isto za zadati jezik, van stranice (email kupcu na jeziku na kom je poručio). */
export async function contentWords(lang: Lang): Promise<Map<string, string>> {
  const settings = await getSettings();
  if (lang === settings.store.language) return new Map();
  const words = contentMap(settings.store.language, lang);
  for (const [source, value] of Object.entries(await getTranslations(lang))) words.set(source, value);
  return words;
}

/**
 * Sadržaj prodavnice (podešavanja, stranica, proizvodi, kategorije) na jeziku stranice:
 * svaki tekst koji ima prevod se zamenjuje njime, ostalo ostaje na glavnom jeziku.
 * Oznake, adrese i slike se ne diraju.
 */
export async function translateForShop<Value>(value: Value): Promise<Value> {
  const words = await getContentWords();
  return words.size === 0 ? value : (translateDeep(value, words) as Value);
}
