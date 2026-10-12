import { requireAdmin } from "@/lib/admin-auth";
import { getCategories, getProducts, getSettings } from "@/lib/content";
import { currencyOf } from "@/lib/settings";
import { ProductForm } from "../../product-form";

type NewProductPageProps = { searchParams: Promise<{ greska?: string }> };

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  await requireAdmin("catalog");
  const { greska } = await searchParams;
  const [categories, settings, products] = await Promise.all([getCategories(), getSettings(), getProducts()]);

  return (
    <ProductForm
      categories={categories}
      others={products.map(({ slug, name }) => ({ slug, name }))}
      currency={currencyOf(settings)}
      error={greska}
    />
  );
}
