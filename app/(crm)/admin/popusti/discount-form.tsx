import Link from "next/link";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { triggerLabels, type Discount, type DiscountTrigger } from "@/lib/discounts";
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
  const threshold =
    discount?.trigger === "amount"
      ? fromMinor(discount.threshold, store.currencyDecimals)
      : discount?.trigger === "weight"
        ? String(discount.threshold)
        : "";

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
                Popust (%) *
                <input
                  name="percent"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  required
                  defaultValue={discount?.percent}
                  className={inputClass}
                />
              </label>
            </div>
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
              <h2 className={panelTitleClass}>Samo za promo kod</h2>

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
            </section>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Samo za nagrade</h2>

              <label className={labelClass}>
                Prag: iznos ({store.currency}) ili težina (g), prema vrsti
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
                Za nagradu posle prve porudžbine prag se ne upisuje. Vrednost porudžbine je zbir
                proizvoda posle popusta, bez dostave. U težinu ulaze samo proizvodi sa upisanom
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
