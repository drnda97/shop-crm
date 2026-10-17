import { getPanelT } from "@/lib/i18n/server";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { categoryTree, inCategory, withDescendants } from "@/lib/catalog";
import { getCategories, getProducts } from "@/lib/content";
import { createCategoryAction, deleteCategoryAction, saveCategoryAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { buttonClass, cardClass, PageHeader, Pager, paginate } from "../ui";

type CategoriesPageProps = { searchParams: Promise<{ greska?: string; strana?: string }> };

/** Polje u redu tabele: niže od polja u formama, da red ostane kompaktan. */
const cellInput =
  "min-h-[40px] w-full rounded-[12px] border-[1.5px] border-line bg-white px-[12px] font-sans text-[15px] font-medium text-ink transition-colors duration-300 hover:border-line-strong focus:border-ink focus:outline-0";
const smallButton =
  "inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-full px-[14px] font-display text-[13.5px] font-bold whitespace-nowrap text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-colors duration-300 hover:bg-band";
const head = "px-[10px] py-[10px] font-display text-[13px] font-semibold text-muted";

/**
 * Kategorije kao tabela: red po kategoriji, sa nazivom i nadkategorijom u polju i brojem
 * proizvoda. Podkategorije su uvučene ispod svoje nadkategorije. Nova kategorija se dodaje u
 * prvom redu, iznad tabele. Polja reda su vezana za formu tog reda atributom `form`, jer forma
 * ne sme da obuhvati red tabele.
 */
export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const t = await getPanelT();
  await requireAdmin("catalog");
  const { greska, strana } = await searchParams;
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const tree = categoryTree(categories);
  // Strane idu po redovima stabla, pa podkategorija ostaje odmah ispod nadkategorije.
  const list = paginate(tree, strana);

  const parentOptions = (blocked: string[]) =>
    tree
      .filter((item) => !blocked.includes(item.category.id))
      .map((item) => (
        <option key={item.category.id} value={item.category.id}>
          {"  ".repeat(item.depth)}
          {item.category.label}
        </option>
      ));

  return (
    <>
      <PageHeader
        title={t("Kategorije")}
        hint={t("Kategorije mogu imati podkategorije. Proizvod se u formi svrstava u jednu glavnu i po želji u dodatne kategorije; proizvod iz podkategorije vidi se i u njenoj nadkategoriji. Na sajtu služe kao filter na stranici Kolekcija.")}
        error={greska}
      />

      <div className={`${cardClass} !p-[8px]`}>
        <form action={createCategoryAction} className="flex flex-wrap items-center gap-[8px] rounded-[18px] bg-band p-[10px]">
          <span className="px-[6px] font-display text-[14px] font-bold">{t("Nova kategorija")}</span>
          <input name="label" required placeholder={t("Naziv, npr. Majice")} aria-label={t("Naziv nove kategorije")} className={`${cellInput} min-w-[180px] flex-1`} />
          <select name="parent" defaultValue="" aria-label={t("Nadkategorija nove kategorije")} className={`${cellInput} w-auto min-w-[200px] flex-1`}>
            <option value="">{t("Na vrhu (bez nadkategorije)")}</option>
            {parentOptions([])}
          </select>
          <button type="submit" className={`${buttonClass} !min-h-[40px] !px-[20px] !text-[14px]`}>
            {t("Dodaj")}
          </button>
        </form>

        {categories.length === 0 ? (
          <p className="px-[12px] py-[16px] text-[15px] text-muted">{t("Još nema kategorija.")}</p>
        ) : (
          <div className="mt-[4px] overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[14.5px]">
              <thead>
                <tr>
                  <th className={head}>
                    {t("Naziv")} <span className="font-normal">({categories.length})</span>
                  </th>
                  <th className={head}>{t("Nadkategorija")}</th>
                  <th className={`${head} text-right`}>{t("Proizvoda")}</th>
                  <th className={head}>
                    <span className="sr-only">{t("Radnje")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.shown.map(({ category, depth }) => {
                  const count = products.filter((product) => inCategory(product, category.id, categories)).length;
                  const form = `kategorija-${category.id}`;
                  return (
                    <tr key={category.id} className="border-t border-line transition-colors duration-200 hover:bg-band/60">
                      <td className="px-[10px] py-[8px]">
                        <div className="flex items-center gap-[8px]" style={{ paddingLeft: `${depth * 24}px` }}>
                          {depth > 0 && (
                            <span aria-hidden className="text-muted">
                              ↳
                            </span>
                          )}
                          <input form={form} name="label" required defaultValue={category.label} aria-label={t("Naziv kategorije")} className={cellInput} />
                        </div>
                      </td>
                      <td className="px-[10px] py-[8px]">
                        {/* Nadkategorija ne može biti sama kategorija ni neka njena podkategorija. */}
                        <select form={form} name="parent" defaultValue={category.parent} aria-label={t("Nadkategorija: {a}", { a: category.label })} className={cellInput}>
                          <option value="">{t("Na vrhu (bez nadkategorije)")}</option>
                          {parentOptions(withDescendants(categories, category.id))}
                        </select>
                      </td>
                      <td className="px-[10px] py-[8px] text-right whitespace-nowrap text-muted">{count}</td>
                      <td className="px-[10px] py-[8px]">
                        <div className="flex justify-end gap-[6px]">
                          <form id={form} action={saveCategoryAction}>
                            <input type="hidden" name="id" value={category.id} />
                            <button type="submit" className={smallButton}>
                              {t("Sačuvaj")}
                            </button>
                          </form>
                          <form action={deleteCategoryAction}>
                            <input type="hidden" name="id" value={category.id} />
                            <ConfirmButton question={t("Obrisati kategoriju „{a}\"?", { a: category.label })} className={smallButton}>
                              {t("Obriši")}
                            </ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {categories.length > 0 && (
        <Pager path={`${ADMIN_PATH}/kategorije`} page={list.page} pages={list.pages} summary={t("Kategorija: {a}", { a: categories.length })} />
      )}
    </>
  );
}
