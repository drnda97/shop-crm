import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { notFound } from "next/navigation";
import { ogLocale } from "@/lib/i18n";
import { getShopCustomDict, getShopLang, getShopPrefix, unknownShopLang } from "@/lib/i18n/server";
import { getShopConfig, getUpsell } from "@/lib/storefront/catalog";
import { getShopSettings, siteUrl } from "@/lib/storefront/pages";
import { themeVars } from "@/lib/theme";
import { themeCssHref } from "@/lib/storefront/theme-css";
import { getTheme, getThemeId } from "@/themes/pages";
import { fontVariables } from "./fonts";

// Proizvodi i podešavanja su u bazi i menjaju se iz panela, pa se stranice prave pri svakoj
// poseti: izmena se vidi odmah, a build ne zavisi od toga da li je baza dostupna.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, base] = await Promise.all([getShopSettings(), siteUrl()]);
  const { name } = settings.store;
  return {
    metadataBase: new URL(base),
    title: { default: name, template: `${name} — %s` },
    ...(settings.site.tagline ? { description: settings.site.tagline } : {}),
    ...(settings.favicon ? { icons: { icon: settings.favicon } } : {}),
    openGraph: { siteName: name, type: "website", locale: ogLocale(await getShopLang()) },
  };
}

/**
 * Prodavnica ima sopstveni root layout, odvojen od panela: stilovi panela
 * (Tailwind, globals.css) se ovde ne učitavaju, a stilovi teme se ne učitavaju u panelu.
 * Izgled je u temi izabranoj u panelu (themes/); ovde su samo podaci i ono što svaka tema dobija.
 */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  // Adresa sa jezikom koji prodavnica nema (/xx/…) ne postoji.
  if (await unknownShopLang()) notFound();
  const [{ Shell }, upsell, config, settings, lang, prefix, custom] = await Promise.all([
    getTheme(),
    getUpsell(),
    getShopConfig(),
    getShopSettings(),
    getShopLang(),
    getShopPrefix(),
    getShopCustomDict(),
  ]);
  const { announcements, announcementMode, announcementSpeed, announcementTone } = settings.site;
  const announcement = { items: announcements, mode: announcementMode, seconds: Number(announcementSpeed) || 6, tone: announcementTone };
  const stylesHref = await themeCssHref(await getThemeId());

  return (
    // Boje i fontovi iz panela (Izgled sajta → Tema) stižu kao CSS promenljive teme.
    <html lang={lang} className={fontVariables} style={themeVars(settings.colors, settings.fonts) as CSSProperties}>
      <head>
        {/* Stilovi izabrane teme; ostale teme se ne učitavaju. */}
        <link rel="stylesheet" href={stylesHref} />
        {/* Sopstveni CSS aktivne teme, posle stilova teme da ih može menjati. */}
        {settings.customCss && <style data-custom-css dangerouslySetInnerHTML={{ __html: settings.customCss }} />}
      </head>
      <body>
        <Shell lang={lang} prefix={prefix} custom={custom} announcement={announcement} upsell={upsell} config={config}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
