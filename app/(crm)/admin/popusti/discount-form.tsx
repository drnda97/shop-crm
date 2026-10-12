import Link from "next/link";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { categoryTree } from "@/lib/catalog";
import { getCategories, getProducts, getSettings } from "@/lib/content";
import { kindLabels, triggerLabels, type Discount, type DiscountKind, type DiscountTrigger } from "@/lib/discounts";
import { fromMinor } from "@/lib/format";
import { saveDiscountAction } from "../actions";
import {
  buttonClass,
  fieldRowClass,
  formGridClass,
  inputClass,
  labelClass,
  PageHeader,
  panelClass,
  panelTitleClass,
  quietButtonClass,
  stackClass,
  textLinkClass,
} from "../ui";

type DiscountFormProps = {
  /** Popust koji se menja; bez njega forma dodaje novi. */
  discount?: Discount;
  error?: string;
};

export async function DiscountForm({ discount, error }: DiscountFormProps) {
  const backPath = `${ADMIN_PATH}/popusti`;
  const { store } = await getSettings();
  // Prag je iznos (u valuti prodavnice) ili težina u gramima, prema vrsti popusta.
  const threshold = !discount?.threshold
    ? ""
    : discount.trigger === "weight"
      ? String(discount.threshold)
      : fromMinor(discount.threshold, store.currencyDecimals);
  const [allProducts, allCategories] = await Promise.all([getProducts(), getCategories()]);
  const products = allProducts.map(({ slug, name }) => ({ slug, name }));
  const categories = categoryTree(allCategories);

  return (
    <>
      <Link href={backPath} className={textLinkClass}>
        ← Popusti
      </Link>
      <div className="mt-[12px]">
        <PageHeader title={discount ? discount.name : "Novi popust"} error={error} />
      </div>

      <form action={saveDiscountAction} className="flex flex-col gap-[16px]">
        <input type="hidden" name="id" value={discount?.id ?? ""} />

        <div className={formGridClass}>
          <section className={panelClass}>
            <h2 className={panelTitleClass}>Popust</h2>
            <label className={labelClass}>
              Naslov * — kod nagrada ga kupac vidi u emailu, iznad koda
              <input
                name="name"
                required
                defaultValue={discount?.name}
                placeholder="npr. Hvala na prvoj porudžbini"
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              Vrsta
              <select
                name="trigger"
                defaultValue={discount?.trigger ?? "public"}
                className={inputClass}
              >
                {(Object.keys(triggerLabels) as DiscountTrigger[]).map((trigger) => (
                  <option key={trigger} value={trigger}>
                    {triggerLabels[trigger]}
                  </option>
                ))}
              </select>
            </label>

            <div className={fieldRowClass}>
              <label className={labelClass}>
                Kod koji kupac upisuje
                <input
                  name="code"
                  defaultValue={discount?.code}
                  placeholder="npr. LETO10"
                  autoComplete="off"
                  maxLength={32}
                  className={`${inputClass} tracking-[0.06em] uppercase`}
                />
              </label>
              <label className={labelClass}>
                Šta popust daje
                <select name="kind" defaultValue={discount?.kind ?? "percent"} className={inputClass}>
                  {(Object.keys(kindLabels) as DiscountKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {kindLabels[kind]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={fieldRowClass}>
              <label className={labelClass}>
                Procenat (%)
                <input
                  name="percent"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  defaultValue={discount?.percent || ""}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Fiksni iznos ({store.currency})
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={discount?.amount ? fromMinor(discount.amount, store.currencyDecimals) : ""}
                  className={inputClass}
                />
              </label>
            </div>
            <p className="mt-[-8px] text-[14px] text-muted">
              Upisuje se polje koje odgovara izboru „Šta popust daje”; besplatna dostava ne traži
              nijedno. Nagrade su uvek procenat na celu korpu.
            </p>
            <p className="mt-[-8px] text-[14px] text-muted">
              Slova bez kvačica, cifre i crtica. Za promo kod je obavezan. Kod nagrade može ostati
              prazan — tada svaki kupac dobija svoj nasumičan kod (npr. {store.codePrefix || "KOD"}
              -7K3Q9X).
            </p>

            <label className={labelClass}>
              Status
              <select
                name="status"
                defaultValue={discount?.status ?? "draft"}
                className={inputClass}
              >
                <option value="draft">Nacrt — ne važi</option>
                <option value="active">Aktivan</option>
              </select>
            </label>
          </section>
          <div className={stackClass}>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Promo kod i automatski popust</h2>
              <p className="mt-[-8px] text-[14px] text-muted">
                Automatski popust važi bez koda čim korpa ispuni uslov. Kada važe i kod kupca i
                automatski popust, primenjuje se onaj koji kupcu više štedi; popusti se ne sabiraju.
              </p>

              <div className={fieldRowClass}>
                <label className={labelClass}>
                  Najviše korišćenja
                  <input
                    name="maxUses"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={discount?.maxUses ?? ""}
                    placeholder="bez ograničenja"
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Važi do (poslednji dan)
                  <input
                    name="expiresAt"
                    type="date"
                    defaultValue={discount?.expiresAt ?? ""}
                    className={inputClass}
                  />
                </label>
              </div>
              {categories.length > 0 && (
                <label className={labelClass}>
                  Samo za kategorije
                  <select
                    name="categories"
                    multiple
                    size={Math.min(6, categories.length)}
                    defaultValue={discount?.categories ?? []}
                    className={`${inputClass} h-auto py-[8px]`}
                  >
                    {categories.map(({ category, depth }) => (
                      <option key={category.id} value={category.id}>
                        {"\u00a0\u00a0".repeat(depth)}
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {products.length > 0 && (
                <label className={labelClass}>
                  Samo za proizvode
                  <select
                    name="products"
                    multiple
                    size={Math.min(8, products.length)}
                    defaultValue={discount?.products ?? []}
                    className={`${inputClass} h-auto py-[8px]`}
                  >
                    {products.map((product) => (
                      <option key={product.slug} value={product.slug}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="mt-[-8px] text-[14px] text-muted">
                Bez izbora popust važi za celu korpu. Više stavki birate uz Ctrl (na Mac-u Cmd).
                Kategorija obuhvata i svoje podkategorije.
              </p>
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Uslov</h2>

              <label className={labelClass}>
                Najmanji iznos korpe ({store.currency}); kod nagrada prag: iznos ili težina (g)
                <input
                  name="threshold"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={threshold}
                  className={inputClass}
                />
              </label>
              <p className="mt-[-8px] text-[14px] text-muted">
                Za promo kod i automatski popust: zbir korpe od kog popust važi (prazno: uvek). Za
                nagradu posle prve porudžbine prag se ne upisuje. Kod nagrada je vrednost porudžbine
                zbir proizvoda posle popusta, bez dostave, a u težinu ulaze samo proizvodi sa upisanom
                težinom.
              </p>
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
