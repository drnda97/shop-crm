"use client";

import { createContext, useContext, type ReactNode } from "react";
import { makeT, type Dict, type Lang, type T } from "@/lib/i18n";
import { localPath } from "@/lib/routes";

const I18nContext = createContext<T>((text, vars) => makeT("sr")(text, vars));
const LangContext = createContext<{ lang: Lang; prefix: string }>({ lang: "sr", prefix: "" });

/**
 * Daje prevod komponentama u pregledaču. Rečnici stižu od onoga ko ga postavlja (tema ili
 * panel), pa prodavnica ne učitava rečnik panela i obrnuto.
 */
export function I18nProvider({
  lang,
  prefix = "",
  dicts,
  children,
}: {
  lang: Lang;
  /** Početak adrese za jezik koji nije glavni ("/en"); prazno za glavni. */
  prefix?: string;
  dicts: Partial<Record<Lang, Dict>>[];
  children: ReactNode;
}) {
  return (
    <LangContext.Provider value={{ lang, prefix }}>
      <I18nContext.Provider value={makeT(lang, ...dicts)}>{children}</I18nContext.Provider>
    </LangContext.Provider>
  );
}

/** `const p = usePath()`: adresa stranice prodavnice na jeziku sajta, npr. p("/kolekcija") → "/collection". */
export function usePath(): (href: string) => string {
  const { lang, prefix } = useContext(LangContext);
  return (href) => localPath(lang, href, prefix);
}

/** Jezik stranice koju kupac gleda. */
export function useLang(): Lang {
  return useContext(LangContext).lang;
}

/** `const t = useT()` u komponenti koja radi u pregledaču. */
export function useT(): T {
  return useContext(I18nContext);
}
