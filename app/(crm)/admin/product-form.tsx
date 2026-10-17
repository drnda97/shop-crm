import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH } from "@/lib/admin-auth";
import type { ReactNode } from "react";
import { categoryPath, categoryTree, type Category, type Collection, type Product } from "@/lib/catalog";
import { formatMoney, fromMinor, type Currency } from "@/lib/format";
import { saveProductAction } from "./actions";
import { CategoryFields } from "./category-fields";
import { StockFields } from "./stock-fields";
import { Picker, RowsEditor } from "./pickers";
import { VariantsEditor } from "./variants-editor";
import {
  buttonClass,
  Checkbox,
  fieldRowClass,
  fileClass,
  IMAGE_ACCEPT,
  IMAGE_HINT,
  inputClass,
  labelClass,
  PageHeader,
  panelClass,
  panelTitleClass,
  quietButtonClass,
  stackClass,
  textLinkClass,
  Thumb,
} from "./ui";

type ProductFormProps = {
  /** Proizvod koji se menja; bez njega forma dodaje novi. */
  product?: Product;
  categories: Category[];
  /** Kolekcije, za izbor u kojima je proizvod. */
  collections: Collection[];
  /** Ostali proizvodi, za izbor sličnih. */
  others: { slug: string; name: string; image?: string; price: number | null }[];
  currency: Currency;
  error?: string;
  /** Sadržaj ispod forme (istorija stanja postojećeg proizvoda). */
  children?: ReactNode;
};

const textareaClass = `${inputClass} min-h-[110px]`;

export async function ProductForm({ product, categories, collections, others, currency, error, children }: ProductFormProps) {
  const t = await getPanelT();
  const tree = categoryTree(categories);
  // Kategorija u izboru: naziv, a ispod putanja nadkategorija („Nameštaj › Sedenje").
  const categoryOptions = tree.map(({ category }) => {
    const parents = categoryPath(categories, category.id).slice(0, -1);
    return { value: category.id, label: category.label, ...(parents.length > 0 ? { hint: parents.map((item) => item.label).join(" › ") } : {}) };
  });
  const backPath = `${ADMIN_PATH}/proizvodi`;
  const priceStep = currency.decimals === 0 ? "1" : "0.01";

  return (
    <>
      <Link href={backPath} className={textLinkClass}>
        {t("← Proizvodi")}
      </Link>
      <div className="mt-[12px]">
        <PageHeader
          title={product ? product.name : t("Novi proizvod")}
          hint={product ? t("Oznaka za sajt i API: {a}", { a: product.slug }) : undefined}
          error={error}
        />
      </div>

      <form action={saveProductAction} className="flex flex-col gap-[16px]">
        <input type="hidden" name="slug" value={product?.slug ?? ""} />

        {/* Kao u Shopify-ju: sadržaj, slike, cena, stanje i varijante u glavnoj koloni; status, kategorije, kolekcije i pretraživači sa strane. */}
        <div className="grid items-start gap-[16px] xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
          <div className={stackClass}>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Osnovno")}</h2>
              <label className={labelClass}>
                {t("Naziv *")}
                <input name="name" required defaultValue={product?.name} className={inputClass} />
              </label>
              <label className={labelClass}>
                {t("Kratak opis (kartica proizvoda)")}
                <input
                  name="summary"
                  maxLength={500}
                  defaultValue={product?.summary}
                  className={inputClass}
                />
              </label>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Opis")}</h2>

              <label className={labelClass}>
                {t("Opis — prazan red razdvaja pasuse")}
                <textarea
                  name="description"
                  defaultValue={product?.description}
                  className={`${inputClass} min-h-[180px]`}
                />
              </label>
              <div className={labelClass}>
                {t("Dodatne sekcije na stranici proizvoda")}
                <span className="font-sans text-[14px] font-normal text-muted">
                  {t("Svaka sekcija je jedan naslov sa tekstom ispod, npr. Dimenzije, Materijali, Održavanje.")}
                </span>
                <RowsEditor
                  name="attributesJson"
                  fields={[
                    { key: "title", label: t("Naslov"), placeholder: t("Naslov, npr. Dimenzije") },
                    { key: "text", label: t("Tekst"), placeholder: t("Tekst sekcije"), multiline: true },
                  ]}
                  defaultRows={(product?.attributes ?? []).map((item) => ({ title: item.title, text: item.text }))}
                  addLabel={t("Dodaj sekciju")}
                  emptyLabel={t("Još nema dodatnih sekcija.")}
                  layout="stacked"
                />
              </div>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Slike")}</h2>
              <div className={labelClass}>
                {t("Glavna slika (")}{t(IMAGE_HINT)})
                <div className="flex flex-wrap items-center gap-[16px]">
                  <Thumb src={product?.image} alt={product?.name ?? t("Novi proizvod")} />
                  <input
                    type="file"
                    name="image"
                    accept={IMAGE_ACCEPT}
                    aria-label={t("Glavna slika")}
                    className={fileClass}
                  />
                </div>
                {product?.image && <span>{t("Ako ne izaberete novu, ostaje trenutna slika.")}</span>}
              </div>

              <div className={labelClass}>
                {t("Dodatne slike (galerija)")}
                {(product?.gallery ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-[16px]">
                    {(product?.gallery ?? []).map((src) => (
                      <label
                        key={src}
                        className="flex cursor-pointer flex-col items-center gap-[6px] text-ink"
                      >
                        <Thumb src={src} alt="" />
                        <span className="flex items-center gap-[6px] text-[13px]">
                          <Checkbox name="galleryRemove" value={src} />
                          {t("Ukloni")}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <input
                  type="file"
                  name="gallery"
                  accept={IMAGE_ACCEPT}
                  multiple
                  aria-label={t("Dodatne slike")}
                  className={fileClass}
                />
                <span>{t("Možete izabrati više slika odjednom (zajedno do 15 MB).")}</span>
              </div>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Cena")}</h2>
              <div className={fieldRowClass}>
                <label className={labelClass}>
                  {t("Cena (")}{currency.code})
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step={priceStep}
                    defaultValue={fromMinor(product?.price, currency.decimals)}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Cena na akciji (")}{currency.code})
                  <input
                    name="salePrice"
                    type="number"
                    min="0"
                    step={priceStep}
                    defaultValue={fromMinor(product?.salePrice, currency.decimals)}
                    placeholder={t("nema akcije")}
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="mt-[-8px] text-[14px] text-muted">
                {t("Proizvod bez upisane cene se vidi na sajtu, ali ne može da se poruči. Cena na akciji je niža od redovne; kupac vidi obe, sa precrtanom redovnom.")}
              </p>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Zalihe")}</h2>
              <StockFields
                sku={product?.sku ?? ""}
                inStock={product?.inStock ?? true}
                stockQty={product?.stockQty ?? null}
                lowStockMode={product?.lowStockMode ?? "off"}
                lowStockThreshold={product?.lowStockThreshold ?? null}
                hasVariants={(product?.variants.length ?? 0) > 0}
              />
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Dostava")}</h2>
              <label className={`${labelClass} max-w-[260px]`}>
                {t("Težina (g)")}
                <input
                  name="weight"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={product?.weight ?? ""}
                  placeholder={t("neobavezno")}
                  className={inputClass}
                />
              </label>
              <p className="mt-[-8px] text-[14px] text-muted">
                {t("Za cenu dostave po težini i popuste koji se dobijaju po težini porudžbine. Bez nje se proizvod ne računa u težinu.")}
              </p>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Opcije i varijante")}</h2>
              <VariantsEditor
                options={product?.options ?? []}
                variants={product?.variants ?? []}
                images={[product?.image, ...(product?.gallery ?? [])].flatMap((src) => (src ? [src] : []))}
                currency={currency}
                {...(product ? { variantBase: `${ADMIN_PATH}/proizvodi/${product.slug}/varijanta` } : {})}
              />
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Istaknuti deo stranice")}</h2>
              <p className="mt-[-8px] text-[14px] text-muted">
                {t("Tamna traka ispod podataka o proizvodu: naslov, tekst, mere i fotografija. Bez naslova se ne prikazuje.")}
              </p>
              <label className={labelClass}>
                {t("Naslov")}
                <input
                  name="highlightHeading"
                  maxLength={200}
                  defaultValue={product?.highlight.heading}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                {t("Tekst")}
                <textarea
                  name="highlightText"
                  maxLength={2000}
                  defaultValue={product?.highlight.text}
                  className={textareaClass}
                />
              </label>
              <div className={labelClass}>
                {t("Mere i činjenice")}
                <RowsEditor
                  name="highlightSpecsJson"
                  fields={[
                    { key: "label", label: t("Naziv"), placeholder: t("Naziv, npr. Širina") },
                    { key: "value", label: t("Vrednost"), placeholder: t("Vrednost, npr. 72 cm") },
                  ]}
                  defaultRows={(product?.highlight.specs ?? []).map((spec) => ({ label: spec.label, value: spec.value }))}
                  addLabel={t("Dodaj meru")}
                  emptyLabel={t("Još nema mera.")}
                  max={8}
                />
              </div>
              <div className={labelClass}>
                {t("Fotografija")}
                <div className="flex flex-wrap items-center gap-[16px]">
                  <Thumb src={product?.highlight.image} alt="" />
                  <input
                    type="file"
                    name="highlightImage"
                    accept={IMAGE_ACCEPT}
                    aria-label={t("Fotografija istaknutog dela")}
                    className={fileClass}
                  />
                </div>
                {product?.highlight.image && (
                  <label className="flex cursor-pointer items-center gap-[10px] text-ink">
                    <Checkbox name="highlightImageRemove" />
                    {t("Ukloni fotografiju")}
                  </label>
                )}
              </div>
            </section>
          </div>
          <div className={stackClass}>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Status")}</h2>
              <label className={labelClass}>
                {t("Vidljivost na sajtu")}
                <select
                  name="status"
                  defaultValue={(product?.active ?? true) ? "active" : "draft"}
                  className={inputClass}
                >
                  <option value="active">{t("Objavljen — vidi se na sajtu")}</option>
                  <option value="draft">{t("Nacrt — ne vidi se")}</option>
                </select>
              </label>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Organizacija")}</h2>
              <CategoryFields options={categoryOptions} main={product?.category ?? ""} extra={product?.categories.slice(1) ?? []} />
              {collections.length > 0 && (
                <div className={labelClass}>
                  {t("Kolekcije")}
                  <input type="hidden" name="collectionsField" value="1" />
                  <Picker
                    name="collections"
                    multiple
                    label={t("Kolekcije")}
                    options={collections.map((collection) => ({ value: collection.id, label: collection.name }))}
                    defaultValue={product ? collections.filter((collection) => collection.productSlugs.includes(product.slug)).map((collection) => collection.id) : []}
                    placeholder={t("Npr. Bestseler, Novo…")}
                  />
                  <span className="font-sans text-[14px] font-normal text-muted">
                    {t("Kolekcija ima svoju stranicu na sajtu, a „Novo“ i „Bestseler“ su i oznaka na kartici proizvoda.")}
                  </span>
                </div>
              )}
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Pretraživači i slični proizvodi")}</h2>
              <label className={labelClass}>
                {t("Naslov za pretraživače")}
                <input
                  name="seoTitle"
                  maxLength={255}
                  placeholder={product?.name}
                  defaultValue={product?.seoTitle}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                {t("Opis za pretraživače")}
                <textarea
                  name="seoDescription"
                  maxLength={500}
                  defaultValue={product?.seoDescription}
                  className={textareaClass}
                />
              </label>
              <p className="mt-[-8px] text-[14px] text-muted">
                {t("Prazno: naziv proizvoda, odnosno početak njegovog opisa.")}
              </p>
              {others.length > 0 && (
                <div className={labelClass}>
                  {t("Slični proizvodi")}
                  <Picker
                    name="related"
                    multiple
                    max={12}
                    label={t("Slični proizvodi")}
                    options={others.map((other) => ({
                      value: other.slug,
                      label: other.name,
                      ...(other.image ? { image: other.image } : {}),
                      ...(other.price !== null ? { hint: formatMoney(other.price, currency) } : {}),
                    }))}
                    defaultValue={product?.related ?? []}
                    placeholder={t("Potražite proizvod po nazivu…")}
                  />
                  <span className="font-sans text-[14px] font-normal text-muted">
                    {t("Prikazuju se ispod opisa, redom kojim ih izaberete (najviše 12). Bez izbora, ili dok ih nema četiri, stranica proizvoda dopunjuje proizvodima iz iste kategorije.")}
                  </span>
                </div>
              )}
            </section>
          </div>
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
      {children}
    </>
  );
}
