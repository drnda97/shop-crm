import { requireAdmin } from "@/lib/admin-auth";
import { createPageAction } from "../../actions";
import { buttonClass, inputClass, labelClass, PageHeader, panelClass } from "../../ui";

type NewPagePageProps = { searchParams: Promise<{ greska?: string }> };

export default async function NewPagePage({ searchParams }: NewPagePageProps) {
  await requireAdmin("content");
  const { greska } = await searchParams;

  return (
    <>
      <PageHeader
        title="Nova stranica"
        hint="Adresa stranice na sajtu pravi se iz naslova i kasnije se ne menja. Stranica nastaje kao nacrt: sekcije dodajete u sledećem koraku, a objavljujete je kada bude gotova."
        error={greska}
      />
      <form action={createPageAction} className={`${panelClass} max-w-[640px]`}>
        <label className={labelClass}>
          Naslov *
          <input name="title" required maxLength={255} className={inputClass} />
        </label>
        <div>
          <button type="submit" className={buttonClass}>
            Napravi stranicu
          </button>
        </div>
      </form>
    </>
  );
}
