import { requireAdmin } from "@/lib/admin-auth";
import { getCategories, getSettings } from "@/lib/content";
import { currencyOf } from "@/lib/settings";
import { ProductForm } from "../../product-form";

type NewProductPageProps = { searchParams: Promise<{ greska?: string }> };

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  await requireAdmin();
  const { greska } = await searchParams;
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);

  return <ProductForm categories={categories} currency={currencyOf(settings)} error={greska} />;
}
