"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useT } from "@/lib/i18n/client";
import { buttonClass, ErrorNote, inputClass, labelClass, textLinkClass } from "./ui";
import { forgotPasswordAction, newPasswordAction, type ForgotState, type NewPasswordState } from "./user-actions";

const noticeClass = "rounded-[18px] bg-white px-[18px] py-[14px] text-[15px] font-medium shadow-soft";

/** Zahtev za link za novu lozinku: korisnik upisuje korisničko ime ili email adresu. */
export function ForgotForm() {
  const t = useT();
  const [state, action, pending] = useActionState<ForgotState, FormData>(forgotPasswordAction, {});

  if (state.sent) {
    return (
      <div className="flex flex-col gap-[16px]">
        <p role="status" className={noticeClass}>
          {t("Ako nalog postoji i ima upisanu email adresu, link za novu lozinku je poslat. Važi jedan sat.")}
        </p>
        <Link href="/admin" className={textLinkClass}>
          {t("← Nazad na prijavu")}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-[16px]">
      <ErrorNote message={state.error} />
      <label className={labelClass}>
        {t("Korisničko ime ili email")}
        <input name="login" autoComplete="username" required maxLength={191} className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={`${buttonClass} mt-[6px] min-h-[58px] w-full`}>
        {t("Pošalji link")}
      </button>
      <Link href="/admin" className={`${textLinkClass} self-center`}>
        {t("← Nazad na prijavu")}
      </Link>
    </form>
  );
}

/** Nova lozinka po linku iz emaila. */
export function NewPasswordForm({ token, min }: { token: string; min: number }) {
  const t = useT();
  const [state, action, pending] = useActionState<NewPasswordState, FormData>(newPasswordAction, {});

  if (state.done) {
    return (
      <div className="flex flex-col gap-[16px]">
        <p role="status" className={noticeClass}>
          {t("Lozinka je promenjena. Odjavljeni ste sa svih uređaja.")}
        </p>
        <Link href="/admin" className={`${buttonClass} min-h-[58px] w-full`}>
          {t("Prijavi se")}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-[16px]">
      <ErrorNote message={state.error} />
      <input type="hidden" name="token" value={token} />
      <label className={labelClass}>
        {t("Nova lozinka (najmanje")} {min} {t("znakova)")}
        <input name="password" type="password" autoComplete="new-password" required minLength={min} className={inputClass} />
      </label>
      <label className={labelClass}>
        {t("Ponovite lozinku")}
        <input name="repeat" type="password" autoComplete="new-password" required minLength={min} className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={`${buttonClass} mt-[6px] min-h-[58px] w-full`}>
        {t("Sačuvaj lozinku")}
      </button>
    </form>
  );
}
