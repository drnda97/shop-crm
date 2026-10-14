import { requireAdmin } from "@/lib/admin-auth";
import { DiscountForm } from "../discount-form";

type NewDiscountPageProps = { searchParams: Promise<{ greska?: string }> };

export default async function NewDiscountPage({ searchParams }: NewDiscountPageProps) {
  await requireAdmin("discounts");
  const { greska } = await searchParams;

  return <DiscountForm error={greska} />;
}
