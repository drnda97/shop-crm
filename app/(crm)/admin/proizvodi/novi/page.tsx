import { requireAdmin } from "@/lib/admin-auth";
import { getCategories, getCollections, getProducts, getSettings } from "@/lib/content";
import { currencyOf } from "@/lib/settings";
import { ProductForm } from "../../product-form";

type NewProductPageProps = { searchParams: Promise<{ greska?: string }> };

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  await requireAdmin("catalog");
  const { greska } = await searchParams;
  const [categories, collections, settings, products] = await Promise.all([getCategories(), getCollections(), getSettings(), getProducts()]);

  return (
    <ProductForm
      categories={categories}
      collections={collections}
      others={products.map(({ slug, name, image, salePrice, price }) => ({ slug, name, image, price: salePrice ?? price }))}
      currency={currencyOf(settings)}
      error={greska}
    />
  );
}
