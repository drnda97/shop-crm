import Link from "next/link";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { triggerLabels, type Discount, type DiscountTrigger } from "@/lib/discounts";
import { fromMinor } from "@/lib/format";
import { saveDiscountAction } from "../actions";
import {
  buttonClass,
  cardClass,
  inputClass,
  labelClass,
  PageHeader,
  quietButtonClass,
} from "../ui";

type DiscountFormProps = {
  /** Popust koji se menja; bez njega forma dodaje novi. */
  discount?: Discount;
  error?: string;
};

const columns = "grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-[16px]";

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
      <Link href={backPath} className="text-[14px] underline">
        ← Popusti
      </Link>
      <div className="mt-[12px]">
        <PageHeader title={discount ? discount.name : "Novi popust"} error={error} />
      </div>

      <form
        action={saveDiscountAction}
        className={`${cardClass} flex max-w-[680px] flex-col gap-[16px]`}
      >
        <input type="hidden" name="id" value={discount?.id ?? ""} />
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
          <select name="trigger" defaultValue={discount?.trigger ?? "public"} className={inputClass}>
            {(Object.keys(triggerLabels) as DiscountTrigger[]).map((trigger) => (
              <option key={trigger} value={trigger}>
                {triggerLabels[trigger]}
              </option>
            ))}
          </select>
        </label>

        <div className={columns}>
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

        <fieldset className="flex flex-col gap-[16px] rounded-[6px] border border-line p-[16px]">
          <legend className="px-[6px] text-[15px] font-medium text-ink">Samo za promo kod</legend>
          <div className={columns}>
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
        </fieldset>

        <fieldset className="flex flex-col gap-[16px] rounded-[6px] border border-line p-[16px]">
          <legend className="px-[6px] text-[15px] font-medium text-ink">Samo za nagrade</legend>
          <label className={`${labelClass} max-w-[320px]`}>
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
            proizvoda posle popusta, bez dostave. U težinu ulaze samo proizvodi sa upisanom težinom.
          </p>
        </fieldset>

        <label className={`${labelClass} max-w-[320px]`}>
          Status
          <select name="status" defaultValue={discount?.status ?? "draft"} className={inputClass}>
            <option value="draft">Nacrt — ne važi</option>
            <option value="active">Aktivan</option>
          </select>
        </label>

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
