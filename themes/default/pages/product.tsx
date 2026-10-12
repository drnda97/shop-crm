import { getShopPath } from "@/lib/i18n/server";
import { getShopT } from "@/lib/i18n/server";
import Link from "next/link";
import type { ComponentProps } from "react";
import type { Templates } from "@/lib/templates";
import type { ShopProduct } from "@/lib/storefront/products";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { ProductCard } from "../components/product-card";
import { ProductView } from "../components/product-view";
import { Reviews } from "../components/reviews";
import { ArrowSmallIcon, DS_STYLE, Photo } from "../components/ui";

export type ProductPageProps = {
  product: ShopProduct;
  /** Do četiri slična proizvoda, već poređana. */
  related: ShopProduct[];
  reviews: ComponentProps<typeof Reviews>["reviews"];
  rating: ComponentProps<typeof Reviews>["summary"];
  loggedIn: boolean;
  /** Tekstovi iz panela: Izgled sajta → Proizvod. */
  texts: Templates["product"];
  /** Podaci za pretraživače (schema.org), spremni za upis u stranicu. */
  structured: unknown;
};

const specLabel = { color: "var(--on-dark-mute)", fontSize: "14.5px" };

/** Stranica proizvoda: /proizvod/{slug}. */
export async function ProductPage({ product, related, reviews, rating, loggedIn, texts, structured }: ProductPageProps) {
  const to = await getShopPath();
  const t = await getShopT();
  const { highlight } = product;

  return (
    <div className="ds" style={DS_STYLE}>
      {/* Znak < se zapisuje kao \u003c, da tekst iz panela ne može da zatvori <script>. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}
      />
      <Header />

      <section style={{ padding: "28px 0 clamp(64px, 8vw, 120px)" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <nav className="crumbs" aria-label={t("Putanja")}>
            <Link href={to("/")}>{t("Početna")}</Link>
            <span>/</span>
            {product.categoryId && (
              <>
                <Link href={to(`/kolekcija/${product.categoryId}`)}>{product.category}</Link>
                <span>/</span>
              </>
            )}
            <span style={{ color: "var(--ink)" }}>{product.name}</span>
          </nav>

          <ProductView product={product} key={product.id} />
        </div>
      </section>

      {/* ISTAKNUTO: naslov, tekst, mere i slika upisani uz proizvod u panelu */}
      {highlight.heading && (
        <section>
          <div className="wrap">
            <div className="dark split rv" style={{ borderRadius: "36px", padding: "clamp(24px, 4vw, 64px)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                <h2 className="display h-l">{highlight.heading}</h2>
                {highlight.text && <p className="lead">{highlight.text}</p>}
                {highlight.specs.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(130px, 100%), 1fr))",
                      gap: "20px",
                      paddingTop: "20px",
                      borderTop: "1px solid color-mix(in srgb, var(--on-dark) 16%, transparent)",
                    }}
                  >
                    {highlight.specs.map((spec) => (
                      <div key={spec.label}>
                        <div style={specLabel}>{spec.label}</div>
                        <div className="display h-s" style={{ marginTop: "4px" }}>{spec.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {highlight.image && (
                <div className="ph zoom" style={{ aspectRatio: "5 / 4" }}>
                  <Photo src={highlight.image} alt="" sizes="(max-width: 900px) 100vw, 560px" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* PREPORUKE */}
      {/* UTISCI */}
      <section style={{ paddingTop: "clamp(72px, 9vw, 136px)" }}>
        <Reviews
          slug={product.slug}
          summary={rating}
          loggedIn={loggedIn}
          reviews={reviews}
        />
      </section>

      {related.length > 0 && (
        <section className="sec">
          <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(28px, 3.6vw, 48px)" }}>
            <div className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 40px" }}>
              <h2 className="display h-l">{texts.relatedHeading}</h2>
              {texts.relatedLinkLabel && (
                <Link className="more" href={to("/kolekcija")}>
                  {texts.relatedLinkLabel} <i><ArrowSmallIcon /></i>
                </Link>
              )}
            </div>
            <div className="grid">
              {related.map((p) => (
                <ProductCard product={p} key={p.id} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
