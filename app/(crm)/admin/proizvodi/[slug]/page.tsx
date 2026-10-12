import { getPanelT } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { findVariant, variantLabel } from "@/lib/catalog";
import { getCategories, getProduct, getProducts, getSettings } from "@/lib/content";
import { currencyOf } from "@/lib/settings";
import { getStockLog } from "@/lib/stock";
import { ProductForm } from "../../product-form";
import { cardClass, panelTitleClass } from "../../ui";

type EditProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ greska?: string }>;
};

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  const t = await getPanelT();
  await requireAdmin("catalog");
  const [{ slug }, { greska }] = await Promise.all([params, searchParams]);
  const [product, products, categories, settings, log] = await Promise.all([
    getProduct(slug),
    getProducts(),
    getCategories(),
    getSettings(),
    getStockLog(slug),
  ]);
  if (!product) notFound();

  const date = new Intl.DateTimeFormat(settings.store.locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: settings.store.timeZone,
  });

  return (
    <ProductForm
      product={product}
      categories={categories}
      others={products.filter((other) => other.slug !== slug).map(({ slug, name }) => ({ slug, name }))}
      currency={currencyOf(settings)}
      error={greska}
    >
      <section className={`${cardClass} mt-[16px]`}>
        <h2 className={panelTitleClass}>{t("Istorija stanja")}</h2>
        {log.length === 0 ? (
          <p className="mt-[8px] text-[15px] text-muted">
            {t("Još nema promena. Beleže se od trenutka kada se uz proizvod ili varijantu upiše broj komada.")}
          </p>
        ) : (
          <div className="mt-[10px] overflow-x-auto">
            <table className="w-full text-left text-[14.5px]">
              <thead>
                <tr className="font-display text-[13px] text-muted">
                  <th className="py-[6px] pr-[16px] font-semibold">{t("Kada")}</th>
                  {product.variants.length > 0 && <th className="py-[6px] pr-[16px] font-semibold">{t("Varijanta")}</th>}
                  <th className="py-[6px] pr-[16px] font-semibold">{t("Promena")}</th>
                  <th className="py-[6px] pr-[16px] font-semibold">{t("Stanje posle")}</th>
                  <th className="py-[6px] font-semibold">{t("Razlog")}</th>
                </tr>
              </thead>
              <tbody>
                {log.map((entry, index) => {
                  const variant = findVariant(product, entry.variantId);
                  return (
                    <tr key={index} className="border-t border-line">
                      <td className="py-[8px] pr-[16px] whitespace-nowrap">{date.format(new Date(entry.at))}</td>
                      {product.variants.length > 0 && (
                        <td className="py-[8px] pr-[16px]">
                          {variant ? variantLabel(variant) : entry.variantId || "—"}
                        </td>
                      )}
                      <td className="py-[8px] pr-[16px] font-display font-bold whitespace-nowrap">
                        {entry.change > 0 ? `+${entry.change}` : entry.change}
                      </td>
                      <td className="py-[8px] pr-[16px]">{entry.qtyAfter ?? "—"}</td>
                      <td className="py-[8px] text-muted">{entry.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ProductForm>
  );
}
