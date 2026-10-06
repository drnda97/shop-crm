import { requireAdmin } from "@/lib/admin-auth";
import { PageForm } from "../page-form";
import { PageHeader } from "../../ui";

type NewPagePageProps = { searchParams: Promise<{ greska?: string }> };

export default async function NewPagePage({ searchParams }: NewPagePageProps) {
  await requireAdmin();
  const { greska } = await searchParams;

  return (
    <>
      <PageHeader
        title="Nova stranica"
        hint="Oznaka stranice (po kojoj je sajt čita) pravi se iz naslova. Fotografije se dodaju kada se stranica sačuva."
        error={greska}
      />
      <PageForm />
    </>
  );
}
