"use client";

import { useT } from "@/lib/i18n/client";
import { useState } from "react";
import { countCombinations, MAX_VARIANTS, parseOptions, syncVariants, variantLabel, type Variant } from "@/lib/catalog";
import { fromMinor, type Currency } from "@/lib/format";
import { sizedSrc } from "@/lib/media";
import { inputClass, labelClass } from "./ui";

/** Red tabele dok se uređuje: cene i broj komada su tekst, kako ih je vlasnik upisao. */
export type VariantRow = {
  enabled: boolean;
  price: string;
  salePrice: string;
  sku: string;
  stockQty: string;
  image: string;
};

type VariantsEditorProps = {
  /** Opcije u obliku za polje: „Tkanina: Pesak #B9AB98, Grafit". */
  options: string;
  variants: Variant[];
  /** Slike proizvoda koje su već sačuvane; od njih se bira slika varijante. */
  images: string[];
  currency: Currency;
};

const cellInput =
  "min-h-[40px] w-full min-w-[84px] rounded-[12px] border-[1.5px] border-line bg-white px-[10px] font-sans text-[15px] font-medium text-ink focus:border-ink focus:outline-0";

function toRow(variant: Variant | undefined, decimals: number): VariantRow {
  return {
    enabled: variant?.enabled ?? true,
    price: fromMinor(variant?.price, decimals),
    salePrice: fromMinor(variant?.salePrice, decimals),
    sku: variant?.sku ?? "",
    stockQty: variant?.stockQty == null ? "" : String(variant.stockQty),
    image: variant?.image ?? "",
  };
}

/**
 * Opcije proizvoda i tabela varijanti u formi proizvoda. Varijante nastaju same, po jedna za
 * svaku kombinaciju vrednosti; ovde se uz svaku upisuju cena, šifra i broj komada.
 * U formu idu polja `options` (tekst) i `variants` (JSON po id-u varijante).
 */
export function VariantsEditor({ options: saved, variants: existing, images, currency }: VariantsEditorProps) {
  const t = useT();
  const [text, setText] = useState(saved);
  const [rows, setRows] = useState<Record<string, VariantRow>>(
    Object.fromEntries(existing.map((variant) => [variant.id, toRow(variant, currency.decimals)])),
  );

  const options = parseOptions(text);
  const count = countCombinations(options);
  const variants = syncVariants(options, []);
  const row = (id: string) => rows[id] ?? toRow(undefined, currency.decimals);
  const change = (id: string, next: Partial<VariantRow>) => setRows({ ...rows, [id]: { ...row(id), ...next } });
  const step = currency.decimals === 0 ? "1" : "0.01";

  return (
    <>
      <label className={labelClass}>
        {t("Šta kupac bira — jedan red po opciji, vrednosti razdvojene zarezom")}
        <textarea
          name="options"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("Veličina: S, M, L\nBoja: Pesak #B9AB98, Grafit #3C4346")}
          className={`${inputClass} min-h-[100px]`}
        />
      </label>
      <p className="mt-[-8px] text-[14px] text-muted">
        {t("Šifra boje (#rrggbb) iza vrednosti prikazuje je kao kružić u toj boji. Svaka kombinacija vrednosti je jedna varijanta, sa svojom cenom, šifrom i stanjem.")}
      </p>
      <input
        type="hidden"
        name="variants"
        value={JSON.stringify(Object.fromEntries(variants.map((variant) => [variant.id, row(variant.id)])))}
      />

      {count > MAX_VARIANTS && (
        <p role="alert" className="rounded-[16px] bg-band px-[16px] py-[12px] text-[14.5px] font-medium">
          {t("Ove opcije daju")} {count} {t("kombinacija, a proizvod može imati najviše")} {MAX_VARIANTS} {t("varijanti. Smanjite broj vrednosti ili podelite proizvod na više proizvoda.")}
        </p>
      )}

      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-[6px] text-left text-[14px]">
            <thead>
              <tr className="font-display text-[13px] font-semibold text-muted">
                <th className="pr-[10px] font-semibold">{t("Varijanta")}</th>
                <th className="pr-[8px] font-semibold">{t("Cena (")}{currency.code})</th>
                <th className="pr-[8px] font-semibold">{t("Na akciji")}</th>
                <th className="pr-[8px] font-semibold">{t("Šifra")}</th>
                <th className="pr-[8px] font-semibold">{t("Komada")}</th>
                {images.length > 0 && <th className="font-semibold">{t("Slika")}</th>}
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => {
                const current = row(variant.id);
                const label = variantLabel(variant);
                return (
                  <tr key={variant.id} className={current.enabled ? undefined : "opacity-50"}>
                    <td className="pr-[10px]">
                      <label className="flex cursor-pointer items-center gap-[8px] font-display text-[14.5px] font-semibold whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="size-[18px] accent-ink"
                          aria-label={`${label}: u ponudi`}
                          checked={current.enabled}
                          onChange={(event) => change(variant.id, { enabled: event.target.checked })}
                        />
                        {label}
                      </label>
                    </td>
                    <td className="pr-[8px]">
                      <input
                        type="number"
                        min="0"
                        step={step}
                        placeholder={t("kao proizvod")}
                        aria-label={`${label}: cena`}
                        value={current.price}
                        onChange={(event) => change(variant.id, { price: event.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="pr-[8px]">
                      <input
                        type="number"
                        min="0"
                        step={step}
                        aria-label={`${label}: cena na akciji`}
                        value={current.salePrice}
                        onChange={(event) => change(variant.id, { salePrice: event.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="pr-[8px]">
                      <input
                        maxLength={64}
                        aria-label={t("{a}: šifra", { a: label })}
                        value={current.sku}
                        onChange={(event) => change(variant.id, { sku: event.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="pr-[8px]">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder={t("ne vodi se")}
                        aria-label={`${label}: broj komada`}
                        value={current.stockQty}
                        onChange={(event) => change(variant.id, { stockQty: event.target.value })}
                        className={cellInput}
                      />
                    </td>
                    {images.length > 0 && (
                      <td>
                        <div className="flex gap-[4px]">
                          {images.map((src, index) => (
                            <button
                              type="button"
                              key={src}
                              aria-label={`${label}: slika ${index + 1}`}
                              aria-pressed={current.image === src}
                              onClick={() => change(variant.id, { image: current.image === src ? "" : src })}
                              className="size-[40px] shrink-0 cursor-pointer overflow-hidden rounded-[10px] opacity-50 outline-offset-1 aria-pressed:opacity-100 aria-pressed:outline-2 aria-pressed:outline-ink hover:opacity-100"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={sizedSrc(src, 320)} alt="" className="size-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {variants.length > 0 && (
        <p className="mt-[-4px] text-[14px] text-muted">
          {t("Prazna cena znači cenu proizvoda (i njegovu akciju). Prazan broj komada znači da se stanje varijante ne vodi i da važi ručno stanje proizvoda; broj komada upisan uz proizvod se tada ne koristi. Varijanta bez kvačice se ne nudi kupcu. Slika varijante se bira među sačuvanim slikama proizvoda.")}
        </p>
      )}
    </>
  );
}
