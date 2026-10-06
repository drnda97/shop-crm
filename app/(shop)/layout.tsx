import type { Metadata } from "next";
import { Red_Hat_Display, Red_Hat_Text } from "next/font/google";
import type { ReactNode } from "react";
import { getShopConfig, getShopProducts } from "@/lib/storefront/catalog";
import { CartProvider } from "./_components/cart";
import { Reveal } from "./_components/reveal";
import "./shop.css";
import "./shop-fonts.css";

// Rezervni fontovi ostaju oni iz shop.css, bez prilagođenog rezervnog fonta koji next/font inače dodaje.
const display = Red_Hat_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-red-hat-display",
  display: "swap",
  adjustFontFallback: false,
});

const sans = Red_Hat_Text({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-red-hat-text",
  display: "swap",
  adjustFontFallback: false,
});

// Proizvodi i podešavanja su u bazi i menjaju se iz panela, pa se stranice prave pri svakoj
// poseti: izmena se vidi odmah, a build ne zavisi od toga da li je baza dostupna.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo Shop — Početna",
};

/**
 * Prodavnica ima sopstveni root layout, odvojen od panela: stilovi panela
 * (Tailwind, globals.css) se ovde ne učitavaju, a shop.css se ne učitava u panelu.
 */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const [products, config] = await Promise.all([getShopProducts(), getShopConfig()]);

  return (
    <html lang="sr" className={`${display.variable} ${sans.variable}`}>
      <body>
        <CartProvider products={products} config={config}>
          {children}
        </CartProvider>
        <Reveal />
      </body>
    </html>
  );
}
