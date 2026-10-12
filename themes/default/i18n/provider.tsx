"use client";

import type { ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { shopDict } from "@/lib/i18n/shop";
import { themeDict } from "./index";

/** Prevod za komponente teme u pregledaču: rečnik jezgra (poruke kupcu) i rečnik teme. */
export function ShopI18n({ lang, prefix, custom, children }: { lang: Lang; prefix: string; custom: Dict; children: ReactNode }) {
  return (
    // Prevodi upisani u panelu imaju prednost nad rečnicima iz koda.
    <I18nProvider lang={lang} prefix={prefix} dicts={[shopDict, themeDict, { [lang]: custom }]}>
      {children}
    </I18nProvider>
  );
}
