import { cache } from "react";
import { getSettings } from "@/lib/content";
import { makeT, type Lang, type T } from "@/lib/i18n";
import { panelDict } from "@/lib/i18n/panel";
import { shopDict } from "@/lib/i18n/shop";
import { themeDict } from "@theme/i18n";

/** Prevod na serveru: jezik prodavnice (sajt i poruke kupcima) i jezik panela su odvojena podešavanja. */

export const getShopLang = cache(async (): Promise<Lang> => (await getSettings()).store.language);
export const getPanelLang = cache(async (): Promise<Lang> => (await getSettings()).store.panelLanguage);

/** Za stranice teme i poruke koje vidi kupac. */
export const getShopT = cache(async (): Promise<T> => makeT(await getShopLang(), shopDict, themeDict));

/** Za panel. Panel prikazuje i nazive iz jezgra (statusi, načini plaćanja), pa uzima i taj rečnik. */
export const getPanelT = cache(async (): Promise<T> => makeT(await getPanelLang(), shopDict, panelDict));

/** Prevod poruka kupcu na jezik prodavnice, van stranice (email, akcije). */
export function shopT(lang: Lang): T {
  return makeT(lang, shopDict, themeDict);
}
