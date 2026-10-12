"use client";

import { createContext, useContext, type ReactNode } from "react";
import { makeT, type Dict, type Lang, type T } from "@/lib/i18n";

const I18nContext = createContext<T>((text, vars) => makeT("sr")(text, vars));

/**
 * Daje prevod komponentama u pregledaču. Rečnici stižu od onoga ko ga postavlja (tema ili
 * panel), pa prodavnica ne učitava rečnik panela i obrnuto.
 */
export function I18nProvider({ lang, dicts, children }: { lang: Lang; dicts: Partial<Record<Lang, Dict>>[]; children: ReactNode }) {
  return <I18nContext.Provider value={makeT(lang, ...dicts)}>{children}</I18nContext.Provider>;
}

/** `const t = useT()` u komponenti koja radi u pregledaču. */
export function useT(): T {
  return useContext(I18nContext);
}
