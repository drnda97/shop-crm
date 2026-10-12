import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { ShopI18n } from "../i18n/provider";
import { Analytics } from "../components/analytics";
import { CartProvider } from "../components/cart";
import { Reveal } from "../components/reveal";

export type ShellProps = {
  /** Jezik sajta iz podešavanja. */
  lang: Lang;
  /** Traka sa obaveštenjem iz panela; prazno: nema je. */
  announcement: string;
  announcementHref: string;
  products: ComponentProps<typeof CartProvider>["products"];
  config: ComponentProps<typeof CartProvider>["config"];
  children: ReactNode;
};

/** Ono što je isto na svakoj stranici, unutar <body>: traka, korpa, merenje poseta. */
export function Shell({ lang, announcement, announcementHref, products, config, children }: ShellProps) {
  return (
    <ShopI18n lang={lang}>
      {announcement && (
        <div className="announce">{announcementHref ? <Link href={announcementHref}>{announcement}</Link> : announcement}</div>
      )}
      <CartProvider products={products} config={config}>
        {children}
        <Analytics />
      </CartProvider>
      <Reveal />
    </ShopI18n>
  );
}
