"use client";

import { useT } from "@/lib/i18n/client";
import { useActionState } from "react";
import { buttonClass, ErrorNote, inputClass, labelClass } from "../ui";
import { confirmTotpAction, type TotpState } from "../user-actions";

/** Potvrda kodom iz aplikacije; posle uspeha prikazuje rezervne kodove, koji se vide samo ovde i samo jednom. */
export function TotpForm() {
  const t = useT();
  const [state, action, pending] = useActionState<TotpState, FormData>(confirmTotpAction, {});

  if (state.codes) {
    return (
      <div className="flex flex-col gap-[12px]">
        <p className="text-[15px] font-medium">{t("Prijava u dva koraka je uključena. Sačuvajte rezervne kodove:")}</p>
        <ul className="grid grid-cols-2 gap-[8px] rounded-[18px] bg-band p-[16px] font-mono text-[16px]">
          {state.codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <p className="text-[14px] text-muted">
          Svaki važi za jednu prijavu, kada telefon nije pri ruci. Posle zatvaranja ove stranice više se ne
          mogu videti; ako ih izgubite, isključite pa ponovo uključite prijavu u dva koraka.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-[12px]">
      <ErrorNote message={state.error} />
      <label className={labelClass}>
        {t("Kod iz aplikacije")}
        <input name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} className={inputClass} />
      </label>
      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {t("Uključi")}
        </button>
      </div>
    </form>
  );
}
