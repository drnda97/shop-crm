import type { ReactNode } from "react";
import type { Section } from "@/lib/sections";
import { getShopProducts } from "@/lib/storefront/catalog";
import { getShopSettings } from "@/lib/storefront/pages";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { DS_STYLE } from "../components/ui";
import * as blocks from "./blocks";

/** Razmak ispod sekcije; poslednja pred podnožjem ima manji. */
const GAP = "clamp(72px, 9vw, 136px)";
const END = "clamp(48px, 6vw, 88px)";
/** Više sekcija „Tekst" zaredom čita se kao jedan tekst. */
const TEXT_GAP = "clamp(36px, 4.5vw, 64px)";

type PageViewProps = {
  sections: Section[];
  /** Parametri iz adrese (?tema=…), za sekcije koje otvaraju izabranu temu. */
  query: Record<string, string | undefined>;
};

/** Stranica sajta: zaglavlje, sekcije redom iz panela, podnožje. */
export async function PageView({ sections, query }: PageViewProps) {
  const [settings, products] = await Promise.all([getShopSettings(), getShopProducts()]);
  // Glavni baner na vrhu nosi zaglavlje preko svoje fotografije.
  const heroFirst = sections[0]?.type === "hero";

  function render(section: Section, index: number): ReactNode {
    const next = sections[index + 1]?.type;
    const last = index === sections.length - 1;
    // Sadržaj je sveden na opis polja pri čitanju iz baze (normalizeSections), pa odgovara tipu sekcije.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = section.data as any;
    const props = {
      data,
      id: (section.data.anchor as string).trim().replace(/^#/, "") || undefined,
      bottom: last ? END : section.type === "text" && next === "text" ? TEXT_GAP : GAP,
    };
    switch (section.type) {
      case "hero":
        // Kartica prednosti prelazi preko banera, pa između njih nema razmaka.
        return <blocks.Hero {...props} bottom={next === "features" ? "0" : props.bottom} withHeader={index === 0} products={products} />;
      case "features":
        return <blocks.Features {...props} overlap={sections[index - 1]?.type === "hero"} />;
      case "tiles":
        return <blocks.Tiles {...props} />;
      case "products":
        return <blocks.Products {...props} />;
      case "split":
        return <blocks.Split {...props} />;
      case "banner":
        return <blocks.Banner {...props} />;
      case "testimonials":
        return <blocks.Testimonials {...props} />;
      case "newsletter":
        return <blocks.Newsletter {...props} />;
      case "intro":
        return <blocks.Intro {...props} />;
      case "photo":
        return <blocks.WidePhoto {...props} />;
      case "text":
        return <blocks.TextBlock {...props} />;
      case "cards":
        return <blocks.Cards {...props} />;
      case "steps":
        return <blocks.Steps {...props} />;
      case "faq":
        return <blocks.Faq {...props} query={query} />;
      case "cta":
        return <blocks.Cta {...props} />;
      case "contact":
        return <blocks.Contact {...props} query={query} store={settings.store} />;
      default:
        return null;
    }
  }

  return (
    <div className="ds" style={DS_STYLE}>
      {!heroFirst && <Header />}
      {sections.map((section, index) => (
        <div style={{ display: "contents" }} data-section={section.id} key={section.id}>
          {render(section, index)}
        </div>
      ))}
      <Footer />
    </div>
  );
}
