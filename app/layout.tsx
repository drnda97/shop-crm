import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Sve je u bazi i menja se iz panela, pa se stranice prave pri svakoj poseti:
// izmena se vidi odmah, a build ne zavisi od toga da li je baza dostupna.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ShopCRM",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sr-Latn">
      <body>{children}</body>
    </html>
  );
}
