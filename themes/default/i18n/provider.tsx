"use client";

import type { ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { shopDict } from "@/lib/i18n/shop";
import { themeDict } from "./index";

/** Prevod za komponente teme u pregledaču: rečnik jezgra (poruke kupcu) i rečnik teme. */
export function ShopI18n({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <I18nProvider lang={lang} dicts={[shopDict, themeDict]}>
      {children}
    </I18nProvider>
  );
}
