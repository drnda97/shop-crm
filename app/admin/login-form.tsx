"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { buttonClass, ErrorNote, inputClass, labelClass } from "./ui";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="flex flex-col gap-[16px]">
      <ErrorNote message={state.error} />
      <label className={labelClass}>
        Korisničko ime
        <input name="username" autoComplete="username" required className={inputClass} />
      </label>
      <label className={labelClass}>
        Lozinka
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Prijavljivanje…" : "Prijavi se"}
      </button>
    </form>
  );
}
