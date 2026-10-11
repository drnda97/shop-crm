import type { Metadata } from "next";
import Link from "next/link";
import { getShopConfig } from "@/lib/storefront/catalog";
import { getShopSettings } from "@/lib/storefront/pages";
import { CollectionGrid } from "../_components/collection-grid";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { ArrowIcon, DS_STYLE, Photo } from "../_components/ui";

export const metadata: Metadata = { title: "Kolekcija", alternates: { canonical: "/kolekcija" } };

type Props = { searchParams: Promise<{ kategorija?: string; pretraga?: string }> };

export default async function CollectionPage({ searchParams }: Props) {
  const { kategorija, pretraga } = await searchParams;
  // Linkovi iz podnožja otvaraju kolekciju sa izabranom kategorijom, a lupa iz zaglavlja sa poljem za pretragu.
  const [config, settings] = await Promise.all([getShopConfig(), getShopSettings()]);
  const category = config.categories.find((c) => c === kategorija) ?? "Sve";
  // Tekstovi i fotografije su iz panela: Izgled sajta → Kolekcija.
  const texts = settings.templates.collection;
  const search = pretraga !== undefined;

  return (
    <div className="ds" style={DS_STYLE}>
      <Header />

      {/* BANER */}
      <section style={{ paddingTop: "16px" }}>
        <div className="wrap">
          <div className="ph" style={{ borderRadius: "36px", minHeight: "380px", display: "flex", alignItems: "flex-end", color: "#FFFFFF", background: "var(--ink-deep)" }}>
            {texts.image.src && (
              <Photo className="img kb" src={texts.image.src} alt={texts.image.alt} sizes="(max-width: 1320px) 100vw, 1240px" position={texts.image.position || undefined} preload />
            )}
            <div style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--ink-deep) 42%, transparent)" }}></div>
            <div
              style={{
                position: "relative",
                width: "100%",
                padding: "clamp(24px, 4vw, 56px)",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: "20px 48px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <nav className="crumbs a1" aria-label="Putanja" style={{ color: "var(--on-dark-soft)" }}>
                  <Link href="/">Početna</Link>
                  <span>/</span>
                  <span style={{ color: "#FFFFFF" }}>Kolekcija</span>
                </nav>
                <h1 className="display h-xl" style={{ fontSize: "clamp(42px, 5.6vw, 84px)" }}>
                  <span className="ln"><span>{texts.title}</span></span>
                </h1>
              </div>
              {texts.text && (
                <p className="a2" style={{ maxWidth: "36ch", color: "var(--on-dark-soft)" }}>
                  {texts.text}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FILTERI + MREŽA */}
      <section style={{ padding: "clamp(28px, 3.6vw, 48px) 0 clamp(72px, 9vw, 128px)" }}>
        <CollectionGrid initialCategory={category} search={search} key={`${category}-${search}`} />
      </section>

      {/* POZIV */}
      {texts.promoHeading && (
        <section style={{ paddingBottom: "clamp(48px, 6vw, 88px)" }}>
          <div className="wrap">
            <div className="panel split rv">
              <div style={{ display: "flex", flexDirection: "column", gap: "18px", alignItems: "flex-start" }}>
                <h2 className="display h-l">{texts.promoHeading}</h2>
                {texts.promoText && <p className="lead">{texts.promoText}</p>}
                {texts.promoButtonLabel && texts.promoButtonHref && (
                  <Link className="btn" href={texts.promoButtonHref}>
                    {texts.promoButtonLabel}
                    <i><ArrowIcon /></i>
                  </Link>
                )}
              </div>
              {texts.promoImage.src && (
                <div className="ph zoom" style={{ aspectRatio: "16 / 10" }}>
                  <Photo src={texts.promoImage.src} alt={texts.promoImage.alt} sizes="(max-width: 900px) 100vw, 600px" position={texts.promoImage.position || undefined} />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
