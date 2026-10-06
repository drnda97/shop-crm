import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getCategories, getProduct, getSettings } from "@/lib/content";
import { currencyOf } from "@/lib/settings";
import { ProductForm } from "../../product-form";

type EditProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ greska?: string }>;
};

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  await requireAdmin();
  const [{ slug }, { greska }] = await Promise.all([params, searchParams]);
  const [product, categories, settings] = await Promise.all([
    getProduct(slug),
    getCategories(),
    getSettings(),
  ]);
  if (!product) notFound();

  return (
    <ProductForm
      product={product}
      categories={categories}
      currency={currencyOf(settings)}
      error={greska}
    />
  );
}
