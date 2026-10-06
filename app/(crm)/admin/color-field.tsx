"use client";

import { useState } from "react";
import { labelClass } from "./ui";

const HEX = /^#[0-9a-f]{6}$/i;

type ColorFieldProps = { name: string; label: string; defaultValue: string };

/**
 * Polje za boju u stilu panela: krug u toj boji otvara birač, a pored je šifra boje
 * koja može i da se upiše ručno. U formu uvek ide poslednja ispravna šifra (#rrggbb),
 * i kada je u polju ostala nedovršena.
 */
export function ColorField({ name, label, defaultValue }: ColorFieldProps) {
  const [value, setValue] = useState(defaultValue);
  // Dok šifra nije potpuna, krug ostaje u poslednjoj ispravnoj boji.
  const [swatch, setSwatch] = useState(defaultValue);

  function change(next: string) {
    setValue(next);
    if (HEX.test(next)) setSwatch(next);
  }

  return (
    <label className={labelClass}>
      {label}
      <input type="hidden" name={name} value={swatch} />
      <span className="flex min-h-[50px] items-center gap-[10px] rounded-full border-[1.5px] border-line bg-white py-[5px] pr-[16px] pl-[5px] transition-colors duration-300 focus-within:border-ink hover:border-line-strong">
        <span
          className="relative size-[38px] shrink-0 overflow-hidden rounded-full shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-[scale] duration-500 ease-shop hover:scale-[1.08]"
          style={{ backgroundColor: swatch }}
        >
          <input
            type="color"
            value={swatch}
            onChange={(event) => change(event.target.value)}
            aria-label={`${label}: izaberi boju`}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </span>
        <input
          type="text"
          value={value}
          onChange={(event) => change(event.target.value.trim())}
          // Nepotpuna šifra se pri izlasku iz polja vraća na poslednju ispravnu boju.
          onBlur={() => setValue(swatch)}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-label={`${label}: šifra boje`}
          className="w-full min-w-0 bg-transparent font-sans text-[16px] font-medium tracking-[0.04em] text-ink uppercase outline-0"
        />
      </span>
    </label>
  );
}
