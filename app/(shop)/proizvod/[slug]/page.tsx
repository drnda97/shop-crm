import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductReviews, ratingSummary } from "@/lib/reviews";
import { getCurrentUser } from "@/lib/storefront/auth";
import { getShopProducts } from "@/lib/storefront/catalog";
import { getShopSettings, siteUrl } from "@/lib/storefront/pages";
import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";
import { ProductCard } from "../../_components/product-card";
import { ProductView } from "../../_components/product-view";
import { Reviews } from "../../_components/reviews";
import { ArrowSmallIcon, DS_STYLE, Photo } from "../../_components/ui";

type Props = { params: Promise<{ slug: string }> };

const specLabel = { color: "var(--on-dark-mute)", fontSize: "14.5px" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = (await getShopProducts()).find((candidate) => candidate.slug === slug);
  if (!product) return {};
  const description = product.seoDescription || (product.description || product.variant).slice(0, 160);
  return {
    title: product.seoTitle || product.name,
    ...(description ? { description } : {}),
    alternates: { canonical: `/proizvod/${product.slug}` },
    openGraph: { title: product.name, ...(product.image ? { images: [product.image] } : {}) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const products = await getShopProducts();
  const product = products.find((candidate) => candidate.slug === slug);
  if (!product) notFound();

  // Slični proizvodi: prvo ručno izabrani u panelu, pa iz iste kategorije, pa ostali.
  const others = products.filter((candidate) => candidate.slug !== product.slug);
  const related = [
    ...new Set([
      ...product.related.flatMap((id) => others.filter((candidate) => candidate.slug === id)),
      ...others.filter((candidate) => candidate.categoryId === product.categoryId),
      ...others,
    ]),
  ].slice(0, 4);

  // Podaci o proizvodu za pretraživače (schema.org), da rezultat pretrage prikaže cenu i dostupnost.
  const [settings, base, reviews, user] = await Promise.all([
    getShopSettings(),
    siteUrl(),
    getProductReviews(product.slug),
    getCurrentUser(),
  ]);
  const rating = ratingSummary(reviews);
  const reviewDate = new Intl.DateTimeFormat(settings.store.locale, { dateStyle: "medium", timeZone: settings.store.timeZone });
  const texts = settings.templates.product;
  const { highlight } = product;
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.image ? { image: [product.image, ...product.gallery].map((src) => `${base}${src}`) } : {}),
    // Ocena se navodi samo kada ima odobrenih utisaka.
    ...(rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average, reviewCount: rating.count } } : {}),
    offers: {
      "@type": "Offer",
      url: `${base}/proizvod/${product.slug}`,
      price: (product.price / 10 ** settings.store.currencyDecimals).toFixed(settings.store.currencyDecimals),
      priceCurrency: settings.store.currency,
      availability: "https://schema.org/InStock",
    },
  };

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
          <nav className="crumbs" aria-label="Putanja">
            <Link href="/">Početna</Link>
            <span>/</span>
            {product.categoryId && (
              <>
                <Link href={`/kolekcija/${product.categoryId}`}>{product.category}</Link>
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
          loggedIn={user !== null}
          reviews={reviews.map((review) => ({
            id: review.id,
            name: review.name,
            rating: review.rating,
            body: review.body,
            date: reviewDate.format(new Date(review.createdAt)),
            verified: review.verified,
          }))}
        />
      </section>

      {related.length > 0 && (
        <section className="sec">
          <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(28px, 3.6vw, 48px)" }}>
            <div className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 40px" }}>
              <h2 className="display h-l">{texts.relatedHeading}</h2>
              {texts.relatedLinkLabel && (
                <Link className="more" href="/kolekcija">
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
