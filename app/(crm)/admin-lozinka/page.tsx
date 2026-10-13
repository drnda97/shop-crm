import type { Metadata } from "next";
import { getSettings } from "@/lib/content";
import { getPanelT } from "@/lib/i18n/server";
import { AuthFrame } from "../admin/auth-frame";
import { ForgotForm } from "../admin/reset-forms";

export const metadata: Metadata = { title: "Nova lozinka", robots: { index: false, follow: false } };

/** Zaboravljena lozinka panela: link stiže na email adresu upisanu uz korisnika. */
export default async function ForgotPasswordPage() {
  const [t, settings] = await Promise.all([getPanelT(), getSettings()]);
  return (
    <AuthFrame name={settings.store.name} hint={t("Upišite korisničko ime ili email adresu, pa ćemo vam poslati link za novu lozinku.")}>
      <ForgotForm />
    </AuthFrame>
  );
}
