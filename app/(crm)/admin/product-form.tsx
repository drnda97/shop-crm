import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH } from "@/lib/admin-auth";
import type { ReactNode } from "react";
import { categoryTree, formatOptions, type Category, type Product } from "@/lib/catalog";
import { fromMinor, type Currency } from "@/lib/format";
import { saveProductAction } from "./actions";
import { VariantsEditor } from "./variants-editor";
import {
  buttonClass,
  Checkbox,
  fieldRowClass,
  fileClass,
  formGridClass,
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
  /** Ostali proizvodi, za izbor sličnih. */
  others: { slug: string; name: string }[];
  currency: Currency;
  error?: string;
  /** Sadržaj ispod forme (istorija stanja postojećeg proizvoda). */
  children?: ReactNode;
};

const textareaClass = `${inputClass} min-h-[110px]`;

export async function ProductForm({ product, categories, others, currency, error, children }: ProductFormProps) {
  const t = await getPanelT();
  const tree = categoryTree(categories);
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

        <div className={formGridClass}>
          <div className={stackClass}>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Osnovno")}</h2>
              <label className={labelClass}>
                {t("Naziv *")}
                <input name="name" required defaultValue={product?.name} className={inputClass} />
              </label>

              <div className={fieldRowClass}>
                <label className={labelClass}>
                  {t("Kategorija")}
                  <select
                    name="category"
                    defaultValue={product?.category ?? ""}
                    className={inputClass}
                  >
                    <option value="">{t("Bez kategorije")}</option>
                    {tree.map(({ category, depth }) => (
                      <option key={category.id} value={category.id}>
                        {"\u00a0\u00a0".repeat(depth)}
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  {t("Šifra artikla")}
                  <input
                    name="sku"
                    maxLength={64}
                    defaultValue={product?.sku}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Status")}
                  <select
                    name="status"
                    defaultValue={(product?.active ?? true) ? "active" : "draft"}
                    className={inputClass}
                  >
                    <option value="active">{t("Objavljen — vidi se na sajtu")}</option>
                    <option value="draft">{t("Nacrt — ne vidi se")}</option>
                  </select>
                </label>
              </div>
              {categories.length > 1 && (
                <fieldset className="flex flex-col gap-[8px]">
                  <legend className={`${labelClass} mb-[8px]`}>{t("Dodatne kategorije")}</legend>
                  <div className="flex flex-wrap gap-x-[20px] gap-y-[8px]">
                    {tree.map(({ category, depth }) => (
                      <label key={category.id} className="flex cursor-pointer items-center gap-[8px] text-[15px]">
                        <Checkbox
                          name="categories"
                          value={category.id}
                          defaultChecked={product?.categories.slice(1).includes(category.id)}
                        />
                        {depth > 0 && <span className="text-muted">›</span>}
                        {category.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-[14px] text-muted">
                    {t("Proizvod se vidi u glavnoj kategoriji, u dodatnim i u svim njihovim nadkategorijama.")}
                  </p>
                </fieldset>
              )}

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
              <label className={labelClass}>
                {t("Dodatne sekcije — jedan red po sekciji, u obliku")} {'„Naslov: tekst"'} {t("(npr. Sastav, Dimenzije, Održavanje)")}
                <textarea
                  name="attributes"
                  defaultValue={product?.attributes
                    .map((item) => `${item.title}: ${item.text}`)
                    .join("\n")}
                  className={textareaClass}
                />
              </label>
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
                <label className={labelClass}>
                  {t("Slični proizvodi")}
                  <select
                    name="related"
                    multiple
                    size={Math.min(8, others.length)}
                    defaultValue={product?.related ?? []}
                    className={`${inputClass} h-auto py-[8px]`}
                  >
                    {others.map((other) => (
                      <option key={other.slug} value={other.slug}>
                        {other.name}
                      </option>
                    ))}
                  </select>
                  <span className="font-sans text-[14px] font-normal text-muted">
                    {t("Više njih birate uz Ctrl (na Mac-u Cmd). Bez izbora, ili dok ih nema četiri, stranica proizvoda nudi proizvode iz iste kategorije.")}
                  </span>
                </label>
              )}
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
              <label className={labelClass}>
                {t("Mere i činjenice — jedan red po stavci, u obliku")} {'„Naziv: vrednost"'}
                <textarea
                  name="highlightSpecs"
                  defaultValue={(product?.highlight.specs ?? [])
                    .map((spec) => `${spec.label}: ${spec.value}`)
                    .join("\n")}
                  placeholder={t("Širina: 72 cm\nNosivost: 130 kg")}
                  className={textareaClass}
                />
              </label>
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
                <label className={labelClass}>
                  {t("Težina (g)")}
                  <input
                    name="weight"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={product?.weight ?? ""}
                    placeholder="neobavezno"
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="mt-[-8px] text-[14px] text-muted">
                {t("Proizvod bez upisane cene se vidi na sajtu, ali ne može da se poruči. Težina služi samo za popuste koji se dobijaju po težini porudžbine.")}
              </p>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Stanje")}</h2>

              <div className={fieldRowClass}>
                <label className={labelClass}>
                  {t("Ručno stanje")}
                  <select
                    name="inStock"
                    defaultValue={(product?.inStock ?? true) ? "yes" : "no"}
                    className={inputClass}
                  >
                    <option value="yes">{t("Na stanju")}</option>
                    <option value="no">{t("Nema na stanju")}</option>
                  </select>
                </label>
                <label className={labelClass}>
                  {t("Broj komada na stanju")}
                  <input
                    name="stockQty"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={product?.stockQty ?? ""}
                    placeholder={t("ne vodi se")}
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="mt-[-8px] text-[14px] text-muted">
                {t("Ako upišete broj komada, stanje se vodi samo: svaka porudžbina ga smanjuje, a na nuli proizvod postaje rasprodat. Dok je polje prazno, važi ručno stanje.")}
              </p>
              <div className={fieldRowClass}>
                <label className={labelClass}>
                  {t("Oznaka „pri kraju“ na sajtu")}
                  <select
                    name="lowStockMode"
                    defaultValue={product?.lowStockMode ?? "off"}
                    className={inputClass}
                  >
                    <option value="off">{t("Ne prikazuj")}</option>
                    <option value="always">{t("Uvek prikazuj")}</option>
                    <option value="auto">{t("Sama, kada broj padne na prag")}</option>
                  </select>
                </label>
                <label className={labelClass}>
                  {t("Prag (komada)")}
                  <input
                    name="lowStockThreshold"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={product?.lowStockThreshold ?? ""}
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="mt-[-8px] text-[14px] text-muted">
                {t("Prag važi samo uz upisan broj komada: sa pragom 5, kupac vidi „Još samo 5 kom.“ čim ih ostane pet ili manje.")}
              </p>
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
          </div>
        </div>

        <section className={panelClass}>
          <h2 className={panelTitleClass}>{t("Opcije i varijante")}</h2>
          <VariantsEditor
            options={formatOptions(product?.options ?? [])}
            variants={product?.variants ?? []}
            images={[product?.image, ...(product?.gallery ?? [])].flatMap((src) => (src ? [src] : []))}
            currency={currency}
          />
        </section>

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
