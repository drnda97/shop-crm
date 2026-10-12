"use client";

import { useT } from "@/lib/i18n/client";
import { useActionState } from "react";
import { buttonClass, ErrorNote, fieldRowClass, inputClass, labelClass } from "../ui";
import { createApiKeyAction, type ApiKeyState } from "../user-actions";

/** Novi API ključ. Ceo ključ se prikazuje samo ovde, odmah po pravljenju. */
export function KeyForm({ scopes }: { scopes: Record<string, string> }) {
  const t = useT();
  const [state, action, pending] = useActionState<ApiKeyState, FormData>(createApiKeyAction, {});

  return (
    <form action={action} className="flex flex-col gap-[14px]">
      <ErrorNote message={state.error} />
      {state.key && (
        <div className="flex flex-col gap-[6px] rounded-[18px] bg-band p-[16px]">
          <p className="text-[15px] font-medium">Ključ je napravljen. Prepišite ga sada; kasnije se ne može videti.</p>
          <code className="font-mono text-[15px] break-all select-all">{state.key}</code>
        </div>
      )}
      <div className={fieldRowClass}>
        <label className={labelClass}>
          {t("Čemu služi")}
          <input name="name" required maxLength={100} placeholder={t("npr. Knjigovodstvo")} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t("Šta sme")}
          <select name="scope" defaultValue="read" className={inputClass}>
            {Object.entries(scopes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {t("Napravi ključ")}
        </button>
      </div>
    </form>
  );
}
