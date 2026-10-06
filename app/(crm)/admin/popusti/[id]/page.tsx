import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getDiscounts } from "@/lib/content";
import { DiscountForm } from "../discount-form";

type EditDiscountPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ greska?: string }>;
};

export default async function EditDiscountPage({ params, searchParams }: EditDiscountPageProps) {
  await requireAdmin();
  const [{ id }, { greska }] = await Promise.all([params, searchParams]);
  const discount = (await getDiscounts()).find((candidate) => candidate.id === id);
  if (!discount) notFound();

  return <DiscountForm discount={discount} error={greska} />;
}
