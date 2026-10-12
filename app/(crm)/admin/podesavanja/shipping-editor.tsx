"use client";

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

function fields(currency: string): Field[] {
  return [
    {
      key: "methods",
      label: "Načini dostave",
      kind: "list",
      itemLabel: "Način dostave",
      max: 12,
      fields: [
        { key: "name", label: "Naziv", kind: "text", hint: "Kako ga kupac vidi pri poručivanju, npr. „Kurirska služba”." },
        { key: "hint", label: "Objašnjenje", kind: "text", hint: "Rok i kurir, npr. „2 do 3 radna dana”." },
        {
          key: "kind",
          label: "Vrsta",
          kind: "select",
          options: [
            { value: "delivery", label: "dostava na adresu" },
            { value: "pickup", label: "lično preuzimanje" },
          ],
        },
        { key: "price", label: `Cena (${currency})`, kind: "text", hint: "Važi kada nema cena po težini. Za preuzimanje obično 0." },
        { key: "freeFrom", label: `Besplatno od iznosa (${currency})`, kind: "text", hint: "Vrednost proizvoda, posle popusta. Prazno: uvek se naplaćuje." },
        {
          key: "weightRates",
          label: "Cena po težini",
          kind: "list",
          itemLabel: "Red",
          max: 12,
          hint: "Neobavezno. Važi prvi red čija granica pokriva težinu porudžbine; teža porudžbina plaća poslednji red.",
          fields: [
            { key: "upTo", label: "Do (kg)", kind: "text" },
            { key: "price", label: `Cena (${currency})`, kind: "text" },
          ],
        },
        { key: "zone", label: "Zona: počeci poštanskih brojeva", kind: "text", hint: "Npr. „11, 21” za Beograd i Novi Sad. Prazno: isporučuje se svuda." },
        { key: "confirmation", label: "Rečenica posle porudžbine", kind: "textarea", hint: "Npr. „Isporuka za 2 do 3 radna dana, kurir zove pre dolaska.”" },
      ],
    },
  ];
}

export function ShippingEditor({ methods, currency }: ShippingEditorProps) {
  const [value, setValue] = useState<SectionData>({ methods });
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();

  function save() {
    startSaving(async () => {
      const result = await saveShippingAction(value.methods);
      setMessage(result.ok ? "Dostava je sačuvana." : result.error);
      if (result.ok) setDirty(false);
    });
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <Fields
        fields={fields(currency)}
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
          {saving ? "Čuvam…" : "Sačuvaj dostavu"}
        </button>
        {message && <span role="status" className="text-[14.5px] font-medium">{message}</span>}
      </div>
    </div>
  );
}
