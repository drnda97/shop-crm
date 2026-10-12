import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { notFound } from "next/navigation";
import { ogLocale } from "@/lib/i18n";
import { getShopCustomDict, getShopLang, getShopPrefix, unknownShopLang } from "@/lib/i18n/server";
import { getShopConfig, getShopProducts } from "@/lib/storefront/catalog";
import { getShopSettings, siteUrl } from "@/lib/storefront/pages";
import { themeVars } from "@/lib/theme";
import { fontVariables } from "@theme/fonts";
import { Shell } from "@theme/pages/shell";
import "@theme/shop.css";
import "@theme/shop-fonts.css";

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
 * Izgled je u temi (themes/default); ovde su samo podaci i ono što svaka tema dobija.
 */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  // Adresa sa jezikom koji prodavnica nema (/xx/…) ne postoji.
  if (await unknownShopLang()) notFound();
  const [products, config, settings, lang, prefix, custom] = await Promise.all([
    getShopProducts(),
    getShopConfig(),
    getShopSettings(),
    getShopLang(),
    getShopPrefix(),
    getShopCustomDict(),
  ]);
  const { announcement, announcementHref } = settings.site;

  return (
    // Boje i fontovi iz panela (Izgled sajta → Tema) stižu kao CSS promenljive teme.
    <html lang={lang} className={fontVariables} style={themeVars(settings.colors, settings.fonts) as CSSProperties}>
      <body>
        <Shell lang={lang} prefix={prefix} custom={custom} announcement={announcement} announcementHref={announcementHref} products={products} config={config}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
