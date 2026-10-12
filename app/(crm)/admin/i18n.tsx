"use client";

import type { ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { panelDict } from "@/lib/i18n/panel";
import { shopDict } from "@/lib/i18n/shop";

/** Prevod za delove panela koji rade u pregledaču: rečnik panela i nazivi iz jezgra (statusi, plaćanje). */
export function PanelI18n({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <I18nProvider lang={lang} dicts={[shopDict, panelDict]}>
      {children}
    </I18nProvider>
  );
}
