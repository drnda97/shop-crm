import { getShopPath } from "@/lib/i18n/server";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { ShopI18n } from "../i18n/provider";
import { Analytics } from "../components/analytics";
import { CartProvider } from "../components/cart";
import { Reveal } from "../components/reveal";

export type ShellProps = {
  /** Jezik stranice, početak adrese za taj jezik ("" ili "/en") i prevodi upisani u panelu. */
  lang: Lang;
  prefix: string;
  custom: Dict;
  /** Traka sa obaveštenjem iz panela; prazno: nema je. */
  announcement: string;
  announcementHref: string;
  /** Predlog u korpi do besplatne dostave, ili null. */
  upsell: ComponentProps<typeof CartProvider>["upsell"];
  config: ComponentProps<typeof CartProvider>["config"];
  children: ReactNode;
};

/** Ono što je isto na svakoj stranici, unutar <body>: traka, korpa, merenje poseta. */
export async function Shell({ lang, prefix, custom, announcement, announcementHref, upsell, config, children }: ShellProps) {
  const to = await getShopPath();
  return (
    <ShopI18n lang={lang} prefix={prefix} custom={custom}>
      {announcement && (
        <div className="announce">{announcementHref ? <Link href={to(announcementHref)}>{announcement}</Link> : announcement}</div>
      )}
      <CartProvider upsell={upsell} config={config}>
        {children}
        <Analytics />
      </CartProvider>
      <Reveal />
    </ShopI18n>
  );
}
