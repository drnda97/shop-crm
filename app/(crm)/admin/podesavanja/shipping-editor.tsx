"use client";

import type { T } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { useState, useTransition } from "react";
import type { Field, SectionData } from "@/lib/sections";
import { saveShippingAction } from "../actions";
import { Fields } from "../fields";
import { buttonClass } from "../ui";

/**
 * Načini dostave u Podešavanjima. Iznosi su ovde tekst, kako ih vlasnik upisuje (1200 ili
 * 12,50), a granice težine u kilogramima; u najmanje jedinice valute i grame ih prevodi akcija.
 */

type ShippingEditorProps = { methods: SectionData[]; currency: string };

function fields(t: T, currency: string): Field[] {
  return [
    {
      key: "methods",
      label: t("Načini dostave"),
      kind: "list",
      itemLabel: t("Način dostave"),
      max: 12,
      fields: [
        { key: "name", label: t("Naziv"), kind: "text", hint: t("Kako ga kupac vidi pri poručivanju, npr. „Kurirska služba”.") },
        { key: "hint", label: t("Objašnjenje"), kind: "text", hint: t("Rok i kurir, npr. „2 do 3 radna dana”.") },
        {
          key: "kind",
          label: t("Vrsta"),
          kind: "select",
          options: [
            { value: "delivery", label: t("dostava na adresu") },
            { value: "pickup", label: t("lično preuzimanje") },
          ],
        },
        { key: "price", label: t("Cena ({a})", { a: currency }), kind: "text", hint: t("Važi kada nema cena po težini. Za preuzimanje obično 0.") },
        { key: "freeFrom", label: t("Besplatno od iznosa ({a})", { a: currency }), kind: "text", hint: t("Vrednost proizvoda, posle popusta. Prazno: uvek se naplaćuje.") },
        {
          key: "weightRates",
          label: t("Cena po težini"),
          kind: "list",
          itemLabel: t("Red"),
          max: 12,
          hint: t("Neobavezno. Važi prvi red čija granica pokriva težinu porudžbine; teža porudžbina plaća poslednji red."),
          fields: [
            { key: "upTo", label: t("Do (kg)"), kind: "text" },
            { key: "price", label: t("Cena ({a})", { a: currency }), kind: "text" },
          ],
        },
        { key: "zone", label: t("Zona: počeci poštanskih brojeva"), kind: "text", hint: t("Npr. „11, 21” za Beograd i Novi Sad. Prazno: isporučuje se svuda.") },
        { key: "confirmation", label: t("Rečenica posle porudžbine"), kind: "textarea", hint: t("Npr. „Isporuka za 2 do 3 radna dana, kurir zove pre dolaska.”") },
      ],
    },
  ];
}

export function ShippingEditor({ methods, currency }: ShippingEditorProps) {
  const t = useT();
  const [value, setValue] = useState<SectionData>({ methods });
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();

  function save() {
    startSaving(async () => {
      const result = await saveShippingAction(value.methods);
      setMessage(result.ok ? t("Dostava je sačuvana.") : t(result.error));
      if (result.ok) setDirty(false);
    });
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <Fields
        fields={fields(t, currency)}
        value={value}
        onChange={(next) => {
          setValue(next);
          setDirty(true);
          setMessage("");
        }}
        options={{ collections: [], products: [], links: [], media: [], onUpload: () => {} }}
      />
      <div className="flex flex-wrap items-center gap-[14px]">
        <button type="button" className={buttonClass} disabled={saving || !dirty} onClick={save}>
          {saving ? t("Čuvam…") : t("Sačuvaj dostavu")}
        </button>
        {message && <span role="status" className="text-[14.5px] font-medium">{message}</span>}
      </div>
    </div>
  );
}
