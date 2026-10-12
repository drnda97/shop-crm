import { getPanelT } from "@/lib/i18n/server";
import { listAdmins, PASSWORD_MIN, requireAdmin, roleHints, roleLabels, type Role } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { ConfirmButton } from "../confirm-button";
import { dateFormats } from "../order-ui";
import {
  buttonClass,
  cardClass,
  Checkbox,
  fieldRowClass,
  inputClass,
  labelClass,
  PageHeader,
  panelClass,
  panelTitleClass,
  quietButtonClass,
} from "../ui";
import {
  createUserAction,
  deleteUserAction,
  resetUserPasswordAction,
  resetUserTotpAction,
  updateUserAction,
} from "../user-actions";

type UsersPageProps = { searchParams: Promise<{ greska?: string; ok?: string }> };

const roles = Object.keys(roleLabels) as Role[];

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const t = await getPanelT();
  const current = await requireAdmin("users");
  const [{ greska, ok }, users, settings] = await Promise.all([searchParams, listAdmins(), getSettings()]);
  const { orderDate } = dateFormats(settings.store);

  const roleSelect = (value: Role) => (
    <select name="role" defaultValue={value} className={inputClass}>
      {roles.map((role) => (
        <option key={role} value={role}>
          {roleLabels[role]} — {roleHints[role]}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <PageHeader
        title={t("Korisnici")}
        hint={t("Ko sme u panel i šta sme da radi. Vlasnik vidi sve; ostale uloge ne vide Podešavanja, Korisnike i Dnevnik.")}
        error={greska}
        notice={ok}
      />

      <div className="flex flex-col gap-[16px]">
        {users.map((user) => (
          <div key={user.id} className={`${cardClass} flex flex-col gap-[14px]`}>
            <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
              <h2 className="text-[19px]">
                {user.name} <span className="font-sans text-[15px] font-normal text-muted">· {user.username}</span>
                {user.id === current.id && <span className="font-sans text-[15px] font-normal text-muted"> {t("· vi")}</span>}
              </h2>
              <span className="text-[14px] text-muted">
                {user.disabled ? "isključen · " : ""}
                {user.totpEnabled ? "prijava u dva koraka · " : ""}
                {user.lastLoginAt ? `poslednja prijava ${orderDate(user.lastLoginAt)}` : "još se nije prijavio"}
              </span>
            </div>
            <form action={updateUserAction} className="flex flex-wrap items-end gap-[12px]">
              <input type="hidden" name="id" value={user.id} />
              <label className={`${labelClass} min-w-[180px] grow basis-0`}>
                {t("Ime")}
                <input name="name" required maxLength={100} defaultValue={user.name} className={inputClass} />
              </label>
              <label className={`${labelClass} min-w-[240px] grow-[2] basis-0`}>
                Uloga
                {roleSelect(user.role)}
              </label>
              <label className="flex min-h-[50px] cursor-pointer items-center gap-[10px] text-[15px]">
                <Checkbox name="disabled" defaultChecked={user.disabled} />
                {t("Isključen")}
              </label>
              <button type="submit" className={quietButtonClass}>
                {t("Sačuvaj")}
              </button>
            </form>
            <details>
              <summary className="cursor-pointer font-display text-[14px] font-bold">{t("Lozinka, prijava u dva koraka, brisanje")}</summary>
              <div className="mt-[12px] flex flex-wrap items-end gap-[12px]">
                <form action={resetUserPasswordAction} className="flex grow flex-wrap items-end gap-[12px]">
                  <input type="hidden" name="id" value={user.id} />
                  <input type="hidden" name="username" value={user.username} />
                  <label className={`${labelClass} min-w-[220px] grow basis-0`}>
                    Nova lozinka (najmanje {PASSWORD_MIN} znakova)
                    <input name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} className={inputClass} />
                  </label>
                  <button type="submit" className={quietButtonClass}>
                    {t("Postavi lozinku")}
                  </button>
                </form>
                {user.totpEnabled && (
                  <form action={resetUserTotpAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <input type="hidden" name="username" value={user.username} />
                    <ConfirmButton question={`Isključiti prijavu u dva koraka za ${user.username}?`} className={quietButtonClass}>
                      {t("Isključi dva koraka")}
                    </ConfirmButton>
                  </form>
                )}
                {user.id !== current.id && (
                  <form action={deleteUserAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <input type="hidden" name="username" value={user.username} />
                    <ConfirmButton question={`Obrisati korisnika ${user.username}?`} className={quietButtonClass}>
                      {t("Obriši")}
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </details>
          </div>
        ))}

        <form action={createUserAction} className={panelClass}>
          <h2 className={panelTitleClass}>{t("Novi korisnik")}</h2>
          <div className={fieldRowClass}>
            <label className={labelClass}>
              {t("Ime")}
              <input name="name" required maxLength={100} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("Korisničko ime ili email")}
              <input name="username" required maxLength={100} autoComplete="off" className={inputClass} />
            </label>
          </div>
          <div className={fieldRowClass}>
            <label className={labelClass}>
              Uloga
              {roleSelect("sales")}
            </label>
            <label className={labelClass}>
              Lozinka (najmanje {PASSWORD_MIN} znakova)
              <input name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} className={inputClass} />
            </label>
          </div>
          <div>
            <button type="submit" className={buttonClass}>
              {t("Dodaj korisnika")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
