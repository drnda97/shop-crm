"use client";

import { useState } from "react";
import type { LowStockMode } from "@/lib/catalog";
import { useT } from "@/lib/i18n/client";
import { fieldRowClass, inputClass, labelClass } from "./ui";

type StockFieldsProps = {
  sku: string;
  inStock: boolean;
  stockQty: number | null;
  lowStockMode: LowStockMode;
  lowStockThreshold: number | null;
  /** Proizvod ima varijante: njihov broj komada se vodi u tabeli varijanti. */
  hasVariants: boolean;
};

const hintClass = "font-sans text-[14px] font-normal text-muted";

/**
 * Zalihe, kao u Shopify-ju: šifra, pa „Prati količinu". Uz praćenje se upisuje broj komada i
 * oznaka „pri kraju" sa pragom; bez njega se samo bira da li je proizvod na stanju.
 * Polja forme su ista kao ranije: sku, inStock, stockQty, lowStockMode, lowStockThreshold.
 */
export function StockFields({ sku, inStock: savedInStock, stockQty, lowStockMode, lowStockThreshold, hasVariants }: StockFieldsProps) {
  const t = useT();
  const [tracked, setTracked] = useState(stockQty !== null);
  const [inStock, setInStock] = useState(savedInStock);
  const [mode, setMode] = useState<LowStockMode>(lowStockMode);
  // „Sama, na pragu" postoji samo uz praćenje količine.
  const shownMode = !tracked && mode === "auto" ? "off" : mode;
  const segment = (on: boolean) =>
    `flex min-h-[46px] grow cursor-pointer items-center justify-center rounded-full px-[18px] font-display text-[14px] font-bold transition-colors ${
      on ? "bg-ink text-paper" : "text-ink hover:bg-band"
    }`;

  return (
    <>
      <label className={labelClass}>
        {t("Šifra artikla (SKU)")}
        <input name="sku" maxLength={64} defaultValue={sku} placeholder={t("neobavezno")} className={inputClass} />
      </label>

      <label className="flex cursor-pointer items-start gap-[12px] text-[15px]">
        <input type="checkbox" checked={tracked} onChange={(event) => setTracked(event.target.checked)} className="mt-[2px] size-[20px] shrink-0 accent-ink" />
        <span className="flex flex-col gap-[2px]">
          <span className="font-display font-bold">{t("Prati količinu")}</span>
          <span className={hintClass}>
            {t("Svaka porudžbina smanjuje broj komada, a na nuli proizvod postaje rasprodat.")}
          </span>
        </span>
      </label>

      {tracked ? (
        <>
          <input type="hidden" name="inStock" value="yes" />
          <div className={fieldRowClass}>
            <label className={labelClass}>
              {t("Komada na stanju")}
              <input name="stockQty" type="number" min="0" step="1" required defaultValue={stockQty ?? 0} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("Oznaka „pri kraju“ na sajtu")}
              <select name="lowStockMode" value={shownMode} onChange={(event) => setMode(event.target.value as LowStockMode)} className={inputClass}>
                <option value="off">{t("Ne prikazuj")}</option>
                <option value="auto">{t("Kada broj padne na prag")}</option>
                <option value="always">{t("Uvek prikazuj")}</option>
              </select>
            </label>
          </div>
          {shownMode === "auto" ? (
            <label className={`${labelClass} max-w-[260px]`}>
              {t("Prag (komada)")}
              <input name="lowStockThreshold" type="number" min="1" step="1" required defaultValue={lowStockThreshold ?? 5} className={inputClass} />
              <span className={hintClass}>{t("Sa pragom 5 kupac vidi „Još samo 5 kom.“ čim ih ostane pet ili manje.")}</span>
            </label>
          ) : (
            <input type="hidden" name="lowStockThreshold" value={lowStockThreshold ?? ""} />
          )}
        </>
      ) : (
        <>
          <input type="hidden" name="stockQty" value="" />
          <input type="hidden" name="inStock" value={inStock ? "yes" : "no"} />
          <input type="hidden" name="lowStockThreshold" value={lowStockThreshold ?? ""} />
          <div className={labelClass}>
            {t("Dostupnost")}
            <div role="radiogroup" aria-label={t("Dostupnost")} className="flex max-w-[420px] gap-[4px] rounded-full bg-white p-[4px] shadow-[inset_0_0_0_1.5px_var(--color-line)]">
              <button type="button" role="radio" aria-checked={inStock} onClick={() => setInStock(true)} className={segment(inStock)}>
                {t("Na stanju")}
              </button>
              <button type="button" role="radio" aria-checked={!inStock} onClick={() => setInStock(false)} className={segment(!inStock)}>
                {t("Nema na stanju")}
              </button>
            </div>
          </div>
          <label className={`${labelClass} max-w-[420px]`}>
            {t("Oznaka „pri kraju“ na sajtu")}
            <select name="lowStockMode" value={shownMode} onChange={(event) => setMode(event.target.value as LowStockMode)} className={inputClass}>
              <option value="off">{t("Ne prikazuj")}</option>
              <option value="always">{t("Uvek prikazuj")}</option>
            </select>
          </label>
        </>
      )}

      {hasVariants && (
        <p className={`rounded-[16px] bg-band px-[14px] py-[10px] ${hintClass}`}>
          {t("Proizvod ima varijante: broj komada svake varijante se upisuje u tabeli varijanti ispod. Ovde upisano važi za varijante kojima broj nije upisan.")}
        </p>
      )}
    </>
  );
}
