"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Picker, type PickerOption } from "./pickers";
import { labelClass } from "./ui";

type CategoryFieldsProps = {
  /** Sve kategorije, sa putanjom nadkategorija u `hint`. */
  options: PickerOption[];
  main: string;
  extra: string[];
};

/** Glavna i dodatne kategorije proizvoda; izabrana glavna se ne nudi među dodatnim. */
export function CategoryFields({ options, main: savedMain, extra }: CategoryFieldsProps) {
  const t = useT();
  const [main, setMain] = useState(savedMain);
  return (
    <>
      <div className={labelClass}>
        {t("Kategorija")}
        <Picker
          name="category"
          label={t("Kategorija")}
          options={options}
          defaultValue={savedMain ? [savedMain] : []}
          noneLabel={t("Bez kategorije")}
          placeholder={t("Potražite kategoriju…")}
          onChange={(values) => setMain(values[0] ?? "")}
        />
      </div>
      {options.length > 1 && (
        <div className={labelClass}>
          {t("Dodatne kategorije")}
          <Picker
            name="categories"
            multiple
            label={t("Dodatne kategorije")}
            options={options}
            exclude={main ? [main] : []}
            defaultValue={extra.filter((id) => id !== savedMain)}
            placeholder={t("Potražite i izaberite jednu ili više…")}
          />
          <span className="font-sans text-[14px] font-normal text-muted">
            {t("Proizvod se vidi u glavnoj kategoriji, u dodatnim i u svim njihovim nadkategorijama.")}
          </span>
        </div>
      )}
    </>
  );
}
