import { getShopT } from "@/lib/i18n/server";
import Link from "next/link";
import { Fragment } from "react";
import { categoryPath, type Category } from "@/lib/catalog";
import { getCategories } from "@/lib/content";
import { getShopSettings } from "@/lib/storefront/pages";
import { CollectionGrid } from "./collection-grid";
import { Footer } from "./footer";
import { Header } from "./header";
import { ArrowIcon, DS_STYLE, Photo } from "./ui";

type CollectionViewProps = {
  /** Kategorija čija je ovo stranica; bez nje su prikazani svi proizvodi. */
  category?: Category;
  /** Otvara polje za pretragu (lupa iz zaglavlja). */
  search: boolean;
};

/**
 * Stranica sa proizvodima: /kolekcija (svi) i /kolekcija/{kategorija}. Baner i poziv ispod
 * mreže su iz panela (Izgled sajta → Kolekcija); na stranici kategorije naslov i tekst su njeni.
 */
export async function CollectionView({ category, search }: CollectionViewProps) {
  const t = await getShopT();
  const [settings, categories] = await Promise.all([getShopSettings(), getCategories()]);
  const texts = settings.templates.collection;
  const path = category ? categoryPath(categories, category.id) : [];
  const intro = category ? category.description : texts.text;

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
                <nav className="crumbs a1" aria-label={t("Putanja")} style={{ color: "var(--on-dark-soft)" }}>
                  <Link href="/">{t("Početna")}</Link>
                  <span>/</span>
                  {path.length === 0 ? (
                    <span style={{ color: "#FFFFFF" }}>{t("Kolekcija")}</span>
                  ) : (
                    <Link href="/kolekcija">{t("Kolekcija")}</Link>
                  )}
                  {path.map((item, index) => (
                    <Fragment key={item.id}>
                      <span>/</span>
                      {index === path.length - 1 ? (
                        <span style={{ color: "#FFFFFF" }}>{item.label}</span>
                      ) : (
                        <Link href={`/kolekcija/${item.id}`}>{item.label}</Link>
                      )}
                    </Fragment>
                  ))}
                </nav>
                <h1 className="display h-xl" style={{ fontSize: "clamp(42px, 5.6vw, 84px)" }}>
                  <span className="ln"><span>{category?.label ?? texts.title}</span></span>
                </h1>
              </div>
              {intro && (
                <p className="a2" style={{ maxWidth: "36ch", color: "var(--on-dark-soft)" }}>
                  {intro}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FILTERI + MREŽA */}
      <section style={{ padding: "clamp(28px, 3.6vw, 48px) 0 clamp(72px, 9vw, 128px)" }}>
        <CollectionGrid initialCategory={category?.id ?? ""} search={search} key={`${category?.id}-${search}`} />
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
