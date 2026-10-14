"use client";

import { useT } from "@/lib/i18n/client";
import { useActionState, useState } from "react";
import { buttonClass, ErrorNote, inputClass, labelClass } from "./ui";
import { setupAction, type SetupState } from "./user-actions";

const initialState: SetupState = {};

/**
 * Prvo pokretanje: nalog vlasnika i naziv prodavnice. Prikazuje se samo dok u panelu nema korisnika.
 * Na serveru traži i kod iz dnevnika servera (codeRequired), da vlasnik ne postane ko prvi otvori /admin.
 */
export function SetupForm({ codeRequired }: { codeRequired: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(setupAction, initialState);
  // Polja su kontrolisana: posle greške ostaje upisano sve osim lozinke.
  const [values, setValues] = useState({ store: "", email: "", name: "", username: "" });
  const field = (name: keyof typeof values) => ({
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [name]: event.target.value }),
    className: inputClass,
  });

  return (
    <form action={action} className="flex flex-col gap-[14px]">
      <ErrorNote message={state.error} />
      {codeRequired && (
        <label className={labelClass}>
          {t("Kod za prvo pokretanje (ispisan u dnevniku servera)")}
          <input name="setupCode" required autoComplete="off" spellCheck={false} className={inputClass} />
        </label>
      )}
      <label className={labelClass}>
        Jezik · Language
        <select name="language" defaultValue="sr" className={inputClass}>
          <option value="sr">Srpski</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className={labelClass}>
        {t("Naziv prodavnice")}
        <input {...field("store")} maxLength={100} placeholder={t("Može i kasnije, u Podešavanjima")} />
      </label>
      <label className={labelClass}>
        {t("Email prodavnice")}
        <input {...field("email")} type="email" maxLength={200} placeholder={t("Može i kasnije")} />
      </label>
      <label className={labelClass}>
        {t("Vaše ime")}
        <input {...field("name")} required maxLength={100} autoComplete="name" />
      </label>
      <label className={labelClass}>
        {t("Korisničko ime ili email za prijavu")}
        <input {...field("username")} required maxLength={100} autoComplete="username" />
      </label>
      <label className={labelClass}>
        {t("Lozinka (najmanje 10 znakova)")}
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </label>
      <label className={labelClass}>
        {t("Lozinka, još jednom")}
        <input name="repeat" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={`${buttonClass} mt-[6px] min-h-[58px] w-full`}>
        {pending ? t("Pravljenje naloga…") : t("Napravi nalog i uđi u panel")}
      </button>
    </form>
  );
}
