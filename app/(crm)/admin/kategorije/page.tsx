import { requireAdmin } from "@/lib/admin-auth";
import { getCategories, getProducts } from "@/lib/content";
import { formatProductCount } from "@/lib/format";
import { createCategoryAction, deleteCategoryAction, saveCategoryAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import {
  buttonClass,
  cardClass,
  inputClass,
  labelClass,
  PageHeader,
  quietButtonClass,
} from "../ui";

type CategoriesPageProps = { searchParams: Promise<{ greska?: string }> };

const fieldClass = `${labelClass} min-w-[180px] grow basis-0`;

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  await requireAdmin();
  const { greska } = await searchParams;
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  return (
    <>
      <PageHeader
        title="Kategorije"
        hint="Svaki proizvod može da pripada jednoj kategoriji, koja se bira u formi proizvoda. Sajt po kategorijama pravi meni ili filtere."
        error={greska}
      />
      <div className={`${cardClass} flex flex-col`}>
        {categories.map((category) => {
          const count = products.filter((product) => product.category === category.id).length;
          return (
            <div
              key={category.id}
              className="flex flex-wrap items-end gap-[12px] border-t border-line py-[16px] first:border-t-0 first:pt-0 last:pb-0"
            >
              <form
                action={saveCategoryAction}
                className="flex grow flex-wrap items-end gap-[12px]"
              >
                <input type="hidden" name="id" value={category.id} />
                <label className={fieldClass}>
                  Naziv
                  <input
                    name="label"
                    required
                    defaultValue={category.label}
                    className={inputClass}
                  />
                </label>
                <button type="submit" className={quietButtonClass}>
                  Sačuvaj
                </button>
              </form>
              <form action={deleteCategoryAction}>
                <input type="hidden" name="id" value={category.id} />
                <ConfirmButton
                  question={`Obrisati kategoriju „${category.label}"?`}
                  className={quietButtonClass}
                >
                  Obriši
                </ConfirmButton>
              </form>
              <div className="w-full text-[13px] text-muted">
                {formatProductCount(count)} · oznaka za API: {category.id}
              </div>
            </div>
          );
        })}
        {categories.length === 0 && <p className="text-[15px] text-muted">Još nema kategorija.</p>}
      </div>

      <form
        action={createCategoryAction}
        className={`${cardClass} mt-[16px] flex flex-wrap items-end gap-[12px]`}
      >
        <label className={fieldClass}>
          Nova kategorija
          <input name="label" required placeholder="npr. Majice" className={inputClass} />
        </label>
        <button type="submit" className={buttonClass}>
          Dodaj kategoriju
        </button>
      </form>
    </>
  );
}
