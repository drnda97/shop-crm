import Link from "next/link";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { formatOptions, type Category, type Product } from "@/lib/catalog";
import { fromMinor, type Currency } from "@/lib/format";
import { saveProductAction } from "./actions";
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
  currency: Currency;
  error?: string;
};

const textareaClass = `${inputClass} min-h-[110px]`;

export function ProductForm({ product, categories, currency, error }: ProductFormProps) {
  const backPath = `${ADMIN_PATH}/proizvodi`;
  const priceStep = currency.decimals === 0 ? "1" : "0.01";

  return (
    <>
      <Link href={backPath} className={textLinkClass}>
        ← Proizvodi
      </Link>
      <div className="mt-[12px]">
        <PageHeader
          title={product ? product.name : "Novi proizvod"}
          hint={product ? `Oznaka za sajt i API: ${product.slug}` : undefined}
          error={error}
        />
      </div>

      <form action={saveProductAction} className="flex flex-col gap-[16px]">
        <input type="hidden" name="slug" value={product?.slug ?? ""} />

        <div className={formGridClass}>
          <div className={stackClass}>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Osnovno</h2>
              <label className={labelClass}>
                Naziv *
                <input name="name" required defaultValue={product?.name} className={inputClass} />
              </label>

              <div className={fieldRowClass}>
                <label className={labelClass}>
                  Kategorija
                  <select
                    name="category"
                    defaultValue={product?.category ?? ""}
                    className={inputClass}
                  >
                    <option value="">Bez kategorije</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Šifra artikla
                  <input
                    name="sku"
                    maxLength={64}
                    defaultValue={product?.sku}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Status
                  <select
                    name="status"
                    defaultValue={(product?.active ?? true) ? "active" : "draft"}
                    className={inputClass}
                  >
                    <option value="active">Objavljen — vidi se na sajtu</option>
                    <option value="draft">Nacrt — ne vidi se</option>
                  </select>
                </label>
              </div>

              <label className={labelClass}>
                Kratak opis (kartica proizvoda)
                <input
                  name="summary"
                  maxLength={500}
                  defaultValue={product?.summary}
                  className={inputClass}
                />
              </label>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Opis</h2>

              <label className={labelClass}>
                Opis — prazan red razdvaja pasuse
                <textarea
                  name="description"
                  defaultValue={product?.description}
                  className={`${inputClass} min-h-[180px]`}
                />
              </label>
              <label className={labelClass}>
                Dodatne sekcije — jedan red po sekciji, u obliku {'„Naslov: tekst"'} (npr. Sastav,
                Dimenzije, Održavanje)
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
              <h2 className={panelTitleClass}>Opcije</h2>
              <label className={labelClass}>
                Šta kupac bira — jedan red po opciji, vrednosti razdvojene zarezom
                <textarea
                  name="options"
                  defaultValue={formatOptions(product?.options ?? [])}
                  placeholder={"Veličina: S, M, L\nBoja: Pesak #B9AB98, Grafit #3C4346"}
                  className={textareaClass}
                />
              </label>
              <p className="mt-[-8px] text-[14px] text-muted">
                Izbor kupca stiže uz porudžbinu. Šifra boje (#rrggbb) iza vrednosti prikazuje je
                kao kružić u toj boji. Cena i stanje su isti za sve opcije.
              </p>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Istaknuti deo stranice</h2>
              <p className="mt-[-8px] text-[14px] text-muted">
                Tamna traka ispod podataka o proizvodu: naslov, tekst, mere i fotografija. Bez
                naslova se ne prikazuje.
              </p>
              <label className={labelClass}>
                Naslov
                <input
                  name="highlightHeading"
                  maxLength={200}
                  defaultValue={product?.highlight.heading}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Tekst
                <textarea
                  name="highlightText"
                  maxLength={2000}
                  defaultValue={product?.highlight.text}
                  className={textareaClass}
                />
              </label>
              <label className={labelClass}>
                Mere i činjenice — jedan red po stavci, u obliku {'„Naziv: vrednost"'}
                <textarea
                  name="highlightSpecs"
                  defaultValue={(product?.highlight.specs ?? [])
                    .map((spec) => `${spec.label}: ${spec.value}`)
                    .join("\n")}
                  placeholder={"Širina: 72 cm\nNosivost: 130 kg"}
                  className={textareaClass}
                />
              </label>
              <div className={labelClass}>
                Fotografija
                <div className="flex flex-wrap items-center gap-[16px]">
                  <Thumb src={product?.highlight.image} alt="" />
                  <input
                    type="file"
                    name="highlightImage"
                    accept={IMAGE_ACCEPT}
                    aria-label="Fotografija istaknutog dela"
                    className={fileClass}
                  />
                </div>
                {product?.highlight.image && (
                  <label className="flex cursor-pointer items-center gap-[10px] text-ink">
                    <Checkbox name="highlightImageRemove" />
                    Ukloni fotografiju
                  </label>
                )}
              </div>
            </section>
          </div>
          <div className={stackClass}>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Cena</h2>
              <div className={fieldRowClass}>
                <label className={labelClass}>
                  Cena ({currency.code})
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
                  Cena na akciji ({currency.code})
                  <input
                    name="salePrice"
                    type="number"
                    min="0"
                    step={priceStep}
                    defaultValue={fromMinor(product?.salePrice, currency.decimals)}
                    placeholder="nema akcije"
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Težina (g)
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
                Proizvod bez upisane cene se vidi na sajtu, ali ne može da se poruči. Težina služi
                samo za popuste koji se dobijaju po težini porudžbine.
              </p>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Stanje</h2>

              <div className={fieldRowClass}>
                <label className={labelClass}>
                  Ručno stanje
                  <select
                    name="inStock"
                    defaultValue={(product?.inStock ?? true) ? "yes" : "no"}
                    className={inputClass}
                  >
                    <option value="yes">Na stanju</option>
                    <option value="no">Nema na stanju</option>
                  </select>
                </label>
                <label className={labelClass}>
                  Broj komada na stanju
                  <input
                    name="stockQty"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={product?.stockQty ?? ""}
                    placeholder="ne vodi se"
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="mt-[-8px] text-[14px] text-muted">
                Ako upišete broj komada, stanje se vodi samo: svaka porudžbina ga smanjuje, a na
                nuli proizvod postaje rasprodat. Dok je polje prazno, važi ručno stanje.
              </p>
              <div className={fieldRowClass}>
                <label className={labelClass}>
                  Oznaka „pri kraju“ na sajtu
                  <select
                    name="lowStockMode"
                    defaultValue={product?.lowStockMode ?? "off"}
                    className={inputClass}
                  >
                    <option value="off">Ne prikazuj</option>
                    <option value="always">Uvek prikazuj</option>
                    <option value="auto">Sama, kada broj padne na prag</option>
                  </select>
                </label>
                <label className={labelClass}>
                  Prag (komada)
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
                Prag važi samo uz upisan broj komada: sa pragom 5, kupac vidi „Još samo 5 kom.“ čim
                ih ostane pet ili manje.
              </p>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Slike</h2>
              <div className={labelClass}>
                Glavna slika ({IMAGE_HINT})
                <div className="flex flex-wrap items-center gap-[16px]">
                  <Thumb src={product?.image} alt={product?.name ?? "Novi proizvod"} />
                  <input
                    type="file"
                    name="image"
                    accept={IMAGE_ACCEPT}
                    aria-label="Glavna slika"
                    className={fileClass}
                  />
                </div>
                {product?.image && <span>Ako ne izaberete novu, ostaje trenutna slika.</span>}
              </div>

              <div className={labelClass}>
                Dodatne slike (galerija)
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
                          Ukloni
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
                  aria-label="Dodatne slike"
                  className={fileClass}
                />
                <span>Možete izabrati više slika odjednom (zajedno do 15 MB).</span>
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-wrap gap-[12px]">
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
