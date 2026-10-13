"use client";

import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";
import { buttonClass, ErrorNote, inputClass, labelClass, textLinkClass } from "./ui";

const initialState: LoginState = {};

/**
 * Prijava u panel. Kada korisnik ima prijavu u dva koraka, posle ispravne lozinke forma
 * traži i kod iz aplikacije; ime i lozinka ostaju upisani.
 */
export function LoginForm() {
  const t = useT();
  const [state, action, pending] = useActionState(login, initialState);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="flex flex-col gap-[16px]">
      <ErrorNote message={state.error} />
      <label className={labelClass}>
        {t("Korisničko ime")}
        <input
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          readOnly={state.needCode}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        {t("Lozinka")}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          readOnly={state.needCode}
          className={inputClass}
        />
      </label>
      {state.needCode && (
        <label className={labelClass}>
          {t("Kod iz aplikacije")}
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            placeholder={t("6 cifara, ili rezervni kod")}
            className={inputClass}
          />
        </label>
      )}
      <button type="submit" disabled={pending} className={`${buttonClass} mt-[6px] min-h-[58px] w-full`}>
        {pending ? t("Prijavljivanje…") : state.needCode ? t("Potvrdi") : t("Prijavi se")}
      </button>
      <Link href="/admin-lozinka" className={`${textLinkClass} self-center`}>
        {t("Zaboravili ste lozinku?")}
      </Link>
    </form>
  );
}
