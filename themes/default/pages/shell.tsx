import type { ComponentProps, ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { ShopI18n } from "../i18n/provider";
import { Analytics } from "../components/analytics";
import { AnnouncementBar, type AnnouncementBarProps } from "../components/announcement";
import { CartProvider } from "../components/cart";
import { Reveal } from "../components/reveal";

export type ShellProps = {
  /** Jezik stranice, početak adrese za taj jezik ("" ili "/en") i prevodi upisani u panelu. */
  lang: Lang;
  prefix: string;
  custom: Dict;
  /** Traka sa obaveštenjima iz panela (Izgled sajta → Zaglavlje); bez poruka je nema. */
  announcement: AnnouncementBarProps;
  /** Predlog u korpi do besplatne dostave, ili null. */
  upsell: ComponentProps<typeof CartProvider>["upsell"];
  config: ComponentProps<typeof CartProvider>["config"];
  children: ReactNode;
};

/** Ono što je isto na svakoj stranici, unutar <body>: traka, korpa, merenje poseta. */
export function Shell({ lang, prefix, custom, announcement, upsell, config, children }: ShellProps) {
  return (
    <ShopI18n lang={lang} prefix={prefix} custom={custom}>
      <AnnouncementBar {...announcement} />
      <CartProvider upsell={upsell} config={config}>
        {children}
        <Analytics />
      </CartProvider>
      <Reveal />
    </ShopI18n>
  );
}
