import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getCollections, getProducts } from "@/lib/content";
import { saveCollectionAction } from "../../actions";
import {
  buttonClass,
  Checkbox,
  formGridClass,
  inputClass,
  labelClass,
  PageHeader,
  panelClass,
  panelTitleClass,
  quietButtonClass,
  textLinkClass,
  Thumb,
} from "../../ui";

type EditCollectionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ greska?: string }>;
};

export default async function EditCollectionPage({
  params,
  searchParams,
}: EditCollectionPageProps) {
  const t = await getPanelT();
  await requireAdmin("catalog");
  const [{ id }, { greska }] = await Promise.all([params, searchParams]);
  const [collections, products] = await Promise.all([getCollections(), getProducts()]);
  const collection = collections.find((candidate) => candidate.id === id);
  if (!collection) notFound();
  const backPath = `${ADMIN_PATH}/kolekcije`;

  return (
    <>
      <Link href={backPath} className={textLinkClass}>
        {t("← Kolekcije")}
      </Link>
      <div className="mt-[12px]">
        <PageHeader title={collection.name} error={greska} />
      </div>

      <form action={saveCollectionAction} className="flex flex-col gap-[16px]">
        <input type="hidden" name="id" value={collection.id} />

        <div className={formGridClass}>
          <section className={panelClass}>
            <h2 className={panelTitleClass}>{t("Kolekcija")}</h2>
            <label className={labelClass}>
              {t("Naziv *")}
              <input name="name" required defaultValue={collection.name} className={inputClass} />
            </label>
            <label className={labelClass}>
              Opis (ispod naslova na stranici kolekcije)
              <textarea
                name="description"
                defaultValue={collection.description}
                className={`${inputClass} min-h-[160px]`}
              />
            </label>
          </section>

          <fieldset className={panelClass}>
            <legend className="sr-only">{t("Proizvodi u kolekciji")}</legend>
            <h2 className={panelTitleClass} aria-hidden="true">
              {t("Proizvodi u kolekciji")}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))] gap-[8px]">
              {products.map((product) => (
                <label
                  key={product.slug}
                  className="flex cursor-pointer items-center gap-[12px] rounded-[18px] bg-band p-[8px] pr-[14px] text-[15px] font-medium transition-colors duration-300 hover:bg-ph has-checked:bg-gold-l/45"
                >
                  <Thumb src={product.image} alt="" />
                  <span className="min-w-0 grow">{product.name}</span>
                  <Checkbox
                    name="products"
                    value={product.slug}
                    defaultChecked={collection.productSlugs.includes(product.slug)}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-wrap gap-[12px]">
          <button type="submit" className={buttonClass}>
            {t("Sačuvaj")}
          </button>
          <Link href={backPath} className={quietButtonClass}>
            {t("Odustani")}
          </Link>
        </div>
      </form>
    </>
  );
}
