import { getPanelT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/admin-auth";
import { categoryTree, inCategory, withDescendants } from "@/lib/catalog";
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
  const t = await getPanelT();
  await requireAdmin("catalog");
  const { greska } = await searchParams;
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const tree = categoryTree(categories);

  return (
    <>
      <PageHeader
        title={t("Kategorije")}
        hint={t("Kategorije mogu imati podkategorije. Proizvod se u formi svrstava u jednu glavnu i po želji u dodatne kategorije; proizvod iz podkategorije vidi se i u njenoj nadkategoriji. Svaka kategorija ima svoju stranicu na sajtu: /kolekcija/oznaka.")}
        error={greska}
      />
      <div className={`${cardClass} flex flex-col`}>
        {tree.map(({ category, depth }) => {
          const count = products.filter((product) => inCategory(product, category.id, categories)).length;
          // Nadkategorija ne može biti sama kategorija ni neka njena podkategorija.
          const blocked = withDescendants(categories, category.id);
          return (
            <div
              key={category.id}
              className="flex flex-wrap items-end gap-[12px] border-t border-line py-[16px] first:border-t-0 first:pt-0 last:pb-0"
              style={{ paddingLeft: `${depth * 28}px` }}
            >
              <form action={saveCategoryAction} className="flex grow flex-wrap items-end gap-[12px]">
                <input type="hidden" name="id" value={category.id} />
                <label className={fieldClass}>
                  {t("Naziv")}
                  <input name="label" required defaultValue={category.label} className={inputClass} />
                </label>
                <label className={fieldClass}>
                  {t("Nadkategorija")}
                  <select name="parent" defaultValue={category.parent} className={inputClass}>
                    <option value="">{t("— nema, na vrhu je —")}</option>
                    {tree
                      .filter((item) => !blocked.includes(item.category.id))
                      .map((item) => (
                        <option key={item.category.id} value={item.category.id}>
                          {"\u00a0\u00a0".repeat(item.depth)}
                          {item.category.label}
                        </option>
                      ))}
                  </select>
                </label>
                <button type="submit" className={quietButtonClass}>
                  {t("Sačuvaj")}
                </button>
                <details className="w-full">
                  <summary className="cursor-pointer font-display text-[14px] font-bold">
                    {t("Tekst i podaci za pretraživače")}
                  </summary>
                  <div className="mt-[12px] flex flex-col gap-[12px]">
                    <label className={labelClass}>
                      {t("Tekst na vrhu stranice kategorije")}
                      <textarea
                        name="description"
                        maxLength={2000}
                        defaultValue={category.description}
                        className={`${inputClass} min-h-[80px]`}
                      />
                    </label>
                    <label className={labelClass}>
                      {t("Naslov za pretraživače")}
                      <input
                        name="seoTitle"
                        maxLength={255}
                        placeholder={category.label}
                        defaultValue={category.seoTitle}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      {t("Opis za pretraživače")}
                      <textarea
                        name="seoDescription"
                        maxLength={500}
                        defaultValue={category.seoDescription}
                        className={`${inputClass} min-h-[70px]`}
                      />
                    </label>
                  </div>
                </details>
              </form>
              <form action={deleteCategoryAction}>
                <input type="hidden" name="id" value={category.id} />
                <ConfirmButton
                  question={t("Obrisati kategoriju „{a}\"?", { a: category.label })}
                  className={quietButtonClass}
                >
                  {t("Obriši")}
                </ConfirmButton>
              </form>
              <div className="w-full text-[13px] text-muted">
                {t(formatProductCount(count))} {t("· na sajtu: /kolekcija/")}{category.id}
              </div>
            </div>
          );
        })}
        {categories.length === 0 && <p className="text-[15px] text-muted">{t("Još nema kategorija.")}</p>}
      </div>

      <form
        action={createCategoryAction}
        className={`${cardClass} mt-[16px] flex flex-wrap items-end gap-[12px]`}
      >
        <label className={fieldClass}>
          {t("Nova kategorija")}
          <input name="label" required placeholder={t("npr. Majice")} className={inputClass} />
        </label>
        <label className={fieldClass}>
          {t("Nadkategorija")}
          <select name="parent" defaultValue="" className={inputClass}>
            <option value="">{t("— nema, na vrhu je —")}</option>
            {tree.map((item) => (
              <option key={item.category.id} value={item.category.id}>
                {"\u00a0\u00a0".repeat(item.depth)}
                {item.category.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass}>
          {t("Dodaj kategoriju")}
        </button>
      </form>
    </>
  );
}
