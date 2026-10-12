import { getPanelT } from "@/lib/i18n/server";
import QRCode from "qrcode";
import { PASSWORD_MIN, pendingTotpSecret, requireAdmin, roleHints, roleLabels } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { otpauthUrl } from "@/lib/totp";
import { buttonClass, inputClass, labelClass, PageHeader, panelClass, panelTitleClass, quietButtonClass } from "../ui";
import { changePasswordAction, disableTotpAction, startTotpAction } from "../user-actions";
import { TotpForm } from "./totp-form";

type AccountPageProps = { searchParams: Promise<{ greska?: string; ok?: string; korak?: string }> };

/** Sopstveni nalog u panelu: lozinka i prijava u dva koraka. Dostupan svakoj ulozi. */
export default async function AccountPage({ searchParams }: AccountPageProps) {
  const t = await getPanelT();
  const user = await requireAdmin();
  const [{ greska, ok, korak }, settings] = await Promise.all([searchParams, getSettings()]);
  // Tajna postoji samo dok je podešavanje u toku; prikazuje se kao QR kod i kao tekst.
  const secret = !user.totpEnabled && korak === "kod" ? await pendingTotpSecret(user.id) : null;
  const qr = secret ? await QRCode.toDataURL(otpauthUrl(secret, user.username, settings.store.name), { margin: 1, width: 220 }) : null;

  return (
    <>
      <PageHeader
        title={t("Moj nalog")}
        hint={`${user.name} · ${user.username} · ${roleLabels[user.role]}: ${roleHints[user.role]}.`}
        error={greska}
        notice={ok}
      />
      <div className="grid items-start gap-[16px] xl:grid-cols-2">
        <form action={changePasswordAction} className={panelClass}>
          <h2 className={panelTitleClass}>{t("Lozinka")}</h2>
          <label className={labelClass}>
            {t("Trenutna lozinka")}
            <input name="current" type="password" autoComplete="current-password" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Nova lozinka (najmanje {PASSWORD_MIN} znakova)
            <input name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} className={inputClass} />
          </label>
          <div>
            <button type="submit" className={buttonClass}>
              {t("Promeni lozinku")}
            </button>
          </div>
        </form>

        <div className={panelClass}>
          <h2 className={panelTitleClass}>{t("Prijava u dva koraka")}</h2>
          {user.totpEnabled ? (
            <>
              <p className="mt-[-8px] text-[15px]">
                {t("Uključena: uz lozinku se traži kod iz aplikacije na vašem telefonu.")}
              </p>
              <form action={disableTotpAction} className="flex flex-col gap-[12px]">
                <label className={labelClass}>
                  {t("Lozinka, za potvrdu")}
                  <input name="current" type="password" autoComplete="current-password" required className={inputClass} />
                </label>
                <div>
                  <button type="submit" className={quietButtonClass}>
                    {t("Isključi prijavu u dva koraka")}
                  </button>
                </div>
              </form>
            </>
          ) : secret && qr ? (
            <>
              <p className="mt-[-8px] text-[15px]">
                Skenirajte kod aplikacijom za jednokratne kodove (Google Authenticator, Aegis, 1Password…), pa
                upišite šest cifara koje prikaže.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={t("QR kod za aplikaciju")} width={220} height={220} className="rounded-[16px]" />
              <p className="text-[14px] text-muted">
                {t("Ne možete da skenirate? Upišite u aplikaciju ovaj ključ:")} <span className="font-mono text-ink">{secret}</span>
              </p>
              <TotpForm />
            </>
          ) : (
            <>
              <p className="mt-[-8px] text-[15px]">
                {t("Uz lozinku se traži i kod iz aplikacije na telefonu, pa ukradena lozinka sama nije dovoljna za ulazak u panel.")}
              </p>
              <form action={startTotpAction}>
                <button type="submit" className={buttonClass}>
                  {t("Podesi")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
