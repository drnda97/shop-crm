"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";
import { buttonClass, ErrorNote, inputClass, labelClass } from "./ui";

const initialState: LoginState = {};

/**
 * Prijava u panel. Kada korisnik ima prijavu u dva koraka, posle ispravne lozinke forma
 * traži i kod iz aplikacije; ime i lozinka ostaju upisani.
 */
export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="flex flex-col gap-[16px]">
      <ErrorNote message={state.error} />
      <label className={labelClass}>
        Korisničko ime
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
        Lozinka
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
          Kod iz aplikacije
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            placeholder="6 cifara, ili rezervni kod"
            className={inputClass}
          />
        </label>
      )}
      <button type="submit" disabled={pending} className={`${buttonClass} mt-[6px] min-h-[58px] w-full`}>
        {pending ? "Prijavljivanje…" : state.needCode ? "Potvrdi" : "Prijavi se"}
      </button>
    </form>
  );
}
