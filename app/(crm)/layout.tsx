import type { Metadata } from "next";
import { Red_Hat_Display, Red_Hat_Text } from "next/font/google";
import type { ReactNode } from "react";
import { getPanelLang } from "@/lib/i18n/server";
import { ConfirmProvider } from "./admin/confirm";
import { PanelI18n } from "./admin/i18n";
import "./globals.css";

// Sve je u bazi i menja se iz panela, pa se stranice prave pri svakoj poseti:
// izmena se vidi odmah, a build ne zavisi od toga da li je baza dostupna.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ShopCRM",
  robots: { index: false, follow: false },
};

// Isti fontovi kao u prodavnici; globals.css ih vezuje za --font-display i --font-sans.
const display = Red_Hat_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-red-hat-display",
  display: "swap",
});

const sans = Red_Hat_Text({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-red-hat-text",
  display: "swap",
});

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Jezik panela je podešavanje; bez baze (prvo pokretanje pre nego što je dostupna) ostaje srpski.
  const lang = await getPanelLang().catch(() => "sr" as const);
  return (
    <html lang={lang === "sr" ? "sr-Latn" : lang} className={`${display.variable} ${sans.variable}`}>
      <body>
        <PanelI18n lang={lang}>
          <ConfirmProvider>{children}</ConfirmProvider>
        </PanelI18n>
      </body>
    </html>
  );
}
