import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { getShopConfig, getShopProducts } from "@/lib/storefront/catalog";
import { getShopSettings, siteUrl } from "@/lib/storefront/pages";
import { themeVars } from "@/lib/theme";
import { CartProvider } from "./_components/cart";
import { fontVariables } from "./fonts";
import { Reveal } from "./_components/reveal";
import "./shop.css";
import "./shop-fonts.css";

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
    openGraph: { siteName: name, type: "website", locale: "sr_RS" },
  };
}

/**
 * Prodavnica ima sopstveni root layout, odvojen od panela: stilovi panela
 * (Tailwind, globals.css) se ovde ne učitavaju, a shop.css se ne učitava u panelu.
 */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const [products, config, settings] = await Promise.all([
    getShopProducts(),
    getShopConfig(),
    getShopSettings(),
  ]);
  const { announcement, announcementHref } = settings.site;

  return (
    // Boje i fontovi iz panela (Izgled sajta → Tema) stižu kao CSS promenljive teme.
    <html lang="sr" className={fontVariables} style={themeVars(settings.colors, settings.fonts) as CSSProperties}>
      <body>
        {announcement && (
          <div className="announce">
            {announcementHref ? <Link href={announcementHref}>{announcement}</Link> : announcement}
          </div>
        )}
        <CartProvider products={products} config={config}>
          {children}
        </CartProvider>
        <Reveal />
      </body>
    </html>
  );
}
