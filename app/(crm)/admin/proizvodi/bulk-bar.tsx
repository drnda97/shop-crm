"use client";

import { useT } from "@/lib/i18n/client";
import { useState } from "react";
import { bulkProductsAction } from "../actions";
import { buttonClass, cardClass, inputClass, labelClass, quietButtonClass } from "../ui";

type BulkBarProps = { categories: { id: string; label: string }[] };

const OPERATIONS = [
  { id: "publish", label: "Objavi" },
  { id: "draft", label: "Prebaci u nacrt" },
  { id: "addCategory", label: "Dodaj u kategoriju" },
  { id: "removeCategory", label: "Ukloni iz kategorije" },
  { id: "price", label: "Promeni cenu za procenat" },
  { id: "delete", label: "Obriši" },
];

/**
 * Ista izmena na svim označenim proizvodima. Polja za označavanje su u redovima spiska i
 * vezana su za ovu formu atributom form="bulk".
 */
export function BulkBar({ categories }: BulkBarProps) {
  const t = useT();
  const [operation, setOperation] = useState("publish");

  function selectAll(checked: boolean) {
    for (const box of document.querySelectorAll<HTMLInputElement>('input[form="bulk"][name="slugs"]')) {
      box.checked = checked;
    }
  }

  return (
    <form
      id="bulk"
      action={bulkProductsAction}
      className={`${cardClass} mt-[16px] flex flex-wrap items-end gap-[12px]`}
      onSubmit={(event) => {
        const count = document.querySelectorAll('input[form="bulk"][name="slugs"]:checked').length;
        if (operation === "delete" && !window.confirm(`Obrisati označene proizvode (${count})? Ne može da se vrati.`)) {
          event.preventDefault();
        }
      }}
    >
      <div className="flex w-full flex-wrap items-center gap-[10px]">
        <span className="font-display text-[15px] font-bold">{t("Označeni proizvodi")}</span>
        <button type="button" className={quietButtonClass} onClick={() => selectAll(true)}>
          {t("Označi sve")}
        </button>
        <button type="button" className={quietButtonClass} onClick={() => selectAll(false)}>
          {t("Poništi")}
        </button>
      </div>
      <label className={`${labelClass} min-w-[220px] grow basis-0`}>
        {t("Šta uraditi")}
        <select name="operation" value={operation} onChange={(event) => setOperation(event.target.value)} className={inputClass}>
          {OPERATIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {(operation === "addCategory" || operation === "removeCategory") && (
        <label className={`${labelClass} min-w-[200px] grow basis-0`}>
          {t("Kategorija")}
          <select name="category" required className={inputClass}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {operation === "price" && (
        <label className={`${labelClass} min-w-[200px] grow basis-0`}>
          Procenat (npr. 10 ili -15)
          <input name="percent" type="number" step="0.1" required className={inputClass} />
        </label>
      )}
      <button type="submit" className={buttonClass}>
        {t("Primeni na označene")}
      </button>
    </form>
  );
}
