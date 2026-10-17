import { getShopPath } from "@/lib/i18n/server";
import { getShopT } from "@/lib/i18n/server";
import Link from "next/link";
import type { Collection } from "@/lib/catalog";
import type { Listing } from "@/lib/storefront/collection";
import { getShopSettings } from "@/lib/storefront/pages";
import type { CardProduct } from "@/lib/storefront/products";
import { CollectionGrid } from "./collection-grid";
import { Footer } from "./footer";
import { Header } from "./header";
import { ArrowIcon, DS_STYLE, Photo } from "./ui";

type CollectionViewProps = {
  /** Kolekcija čija je ovo stranica (/kolekcija/{id}); baner je njena fotografija ako je ima i ako je tako izabrano u panelu. */
  collection?: Collection;
  /** Otvara polje za pretragu (lupa iz zaglavlja). */
  search: boolean;
  /** Proizvodi za izbor iz adrese (filteri, pretraga, redosled, strana), izračunati na serveru. */
  listing: Listing<CardProduct>;
};

/**
 * Stranica sa proizvodima: /kolekcija (svi) i /kolekcija/{kolekcija}. Kategorija je filter u
 * mreži, bez svoje stranice. Baner i poziv ispod mreže su iz panela (Izgled sajta → Kolekcija);
 * na stranici kolekcije naslov i tekst su njeni, a može da ima i svoju fotografiju banera.
 */
export async function CollectionView({ collection, search, listing }: CollectionViewProps) {
  const to = await getShopPath();
  const t = await getShopT();
  const settings = await getShopSettings();
  const texts = settings.templates.collection;
  const intro = collection ? collection.description : texts.text;
  const banner =
    collection?.image && texts.bannerSource === "own"
      ? { src: collection.image, alt: collection.imageAlt, position: "" }
      : texts.image;

  return (
    <div className="ds" style={DS_STYLE}>
      <Header />

      {/* BANER */}
      <section style={{ paddingTop: "16px" }}>
        <div className="wrap">
          <div className="ph" style={{ borderRadius: "36px", minHeight: "380px", display: "flex", alignItems: "flex-end", color: "#FFFFFF", background: "var(--ink-deep)" }}>
            {banner.src && (
              <Photo className="img kb" src={banner.src} alt={banner.alt} sizes="(max-width: 1320px) 100vw, 1240px" position={banner.position || undefined} preload />
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
                  <Link href={to("/")}>{t("Početna")}</Link>
                  <span>/</span>
                  {collection ? (
                    <>
                      <Link href={to("/kolekcija")}>{t("Kolekcija")}</Link>
                      <span>/</span>
                      <span style={{ color: "#FFFFFF" }}>{collection.name}</span>
                    </>
                  ) : (
                    <span style={{ color: "#FFFFFF" }}>{t("Kolekcija")}</span>
                  )}
                </nav>
                <h1 className="display h-xl" style={{ fontSize: "clamp(42px, 5.6vw, 84px)" }}>
                  <span className="ln"><span>{collection?.name ?? texts.title}</span></span>
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
        <CollectionGrid
          collection={collection?.id}
          search={search}
          listing={listing}
          currency={settings.store.currency}
          key={`${collection?.id}-${search}`}
        />
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
                  <Link className="btn" href={to(texts.promoButtonHref)}>
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
