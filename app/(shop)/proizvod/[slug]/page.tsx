import { getShopPath } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductReviews, ratingSummary } from "@/lib/reviews";
import { getCurrentUser } from "@/lib/storefront/auth";
import { getRelated, getShopProduct } from "@/lib/storefront/catalog";
import { getShopSettings, siteUrl } from "@/lib/storefront/pages";
import { ProductPage } from "@/themes/pages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getShopProduct(slug);
  if (!product) return {};
  const description = product.seoDescription || (product.description || product.variant).slice(0, 160);
  return {
    title: product.seoTitle || product.name,
    ...(description ? { description } : {}),
    alternates: { canonical: (await getShopPath())(`/proizvod/${product.slug}`) },
    openGraph: { title: product.name, ...(product.image ? { images: [product.image] } : {}) },
  };
}

export default async function ProductRoute({ params }: Props) {
  const { slug } = await params;
  const product = await getShopProduct(slug);
  if (!product) notFound();
  const related = await getRelated(product);

  // Podaci o proizvodu za pretraživače (schema.org), da rezultat pretrage prikaže cenu i dostupnost.
  const [settings, base, reviews, user] = await Promise.all([
    getShopSettings(),
    siteUrl(),
    getProductReviews(product.slug),
    getCurrentUser(),
  ]);
  const rating = ratingSummary(reviews);
  const reviewDate = new Intl.DateTimeFormat(settings.store.locale, { dateStyle: "medium", timeZone: settings.store.timeZone });
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
      url: `${base}${(await getShopPath())(`/proizvod/${product.slug}`)}`,
      price: (product.price / 10 ** settings.store.currencyDecimals).toFixed(settings.store.currencyDecimals),
      priceCurrency: settings.store.currency,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <ProductPage
      product={product}
      related={related}
      rating={rating}
      loggedIn={user !== null}
      texts={settings.templates.product}
      structured={structured}
      reviews={reviews.map((review) => ({
        id: review.id,
        name: review.name,
        rating: review.rating,
        body: review.body,
        date: reviewDate.format(new Date(review.createdAt)),
        verified: review.verified,
      }))}
    />
  );
}
