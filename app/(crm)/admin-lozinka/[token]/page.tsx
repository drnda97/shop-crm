import type { Metadata } from "next";
import Link from "next/link";
import { isAdminResetValid, PASSWORD_MIN } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { getPanelT } from "@/lib/i18n/server";
import { AuthFrame } from "../../admin/auth-frame";
import { NewPasswordForm } from "../../admin/reset-forms";
import { textLinkClass } from "../../admin/ui";

export const metadata: Metadata = { title: "Nova lozinka", robots: { index: false, follow: false } };

export default async function NewPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, t, settings] = await Promise.all([params, getPanelT(), getSettings()]);
  const valid = await isAdminResetValid(token);
  return (
    <AuthFrame
      name={settings.store.name}
      hint={valid ? t("Upišite novu lozinku za svoj nalog.") : t("Link više ne važi: istekao je ili je već iskorišćen.")}
    >
      {valid ? (
        <NewPasswordForm token={token} min={PASSWORD_MIN} />
      ) : (
        <Link href="/admin-lozinka" className={textLinkClass}>
          {t("Zatražite novi link")}
        </Link>
      )}
    </AuthFrame>
  );
}
