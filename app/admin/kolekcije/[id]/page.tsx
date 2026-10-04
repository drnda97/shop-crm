import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getCollections, getProducts } from "@/lib/content";
import { saveCollectionAction } from "../../actions";
import {
  buttonClass,
  cardClass,
  Checkbox,
  inputClass,
  labelClass,
  PageHeader,
  quietButtonClass,
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
  await requireAdmin();
  const [{ id }, { greska }] = await Promise.all([params, searchParams]);
  const [collections, products] = await Promise.all([getCollections(), getProducts()]);
  const collection = collections.find((candidate) => candidate.id === id);
  if (!collection) notFound();
  const backPath = `${ADMIN_PATH}/kolekcije`;

  return (
    <>
      <Link href={backPath} className="text-[14px] underline">
        ← Kolekcije
      </Link>
      <div className="mt-[12px]">
        <PageHeader title={collection.name} error={greska} />
      </div>

      <form
        action={saveCollectionAction}
        className={`${cardClass} flex max-w-[680px] flex-col gap-[16px]`}
      >
        <input type="hidden" name="id" value={collection.id} />
        <label className={labelClass}>
          Naziv *
          <input name="name" required defaultValue={collection.name} className={inputClass} />
        </label>
        <label className={labelClass}>
          Opis (ispod naslova na stranici kolekcije)
          <textarea
            name="description"
            defaultValue={collection.description}
            className={`${inputClass} min-h-[90px]`}
          />
        </label>

        <fieldset className="flex flex-col">
          <legend className="mb-[4px] text-[14px] text-muted">Proizvodi u kolekciji</legend>
          {products.map((product) => (
            <label
              key={product.slug}
              className="flex cursor-pointer items-center gap-[12px] border-t border-line py-[8px] text-[15px] first:border-t-0"
            >
              <Checkbox
                name="products"
                value={product.slug}
                defaultChecked={collection.productSlugs.includes(product.slug)}
              />
              <Thumb src={product.image} alt="" />
              {product.name}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-[12px] pt-[8px]">
          <button type="submit" className={buttonClass}>
            Sačuvaj
          </button>
          <Link href={backPath} className={quietButtonClass}>
            Odustani
          </Link>
        </div>
      </form>
    </>
  );
}
