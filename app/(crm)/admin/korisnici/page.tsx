import { getPanelT } from "@/lib/i18n/server";
import { ADMIN_PATH, areaLabels, getRoles, listAdmins, OWNER_ROLE, PASSWORD_MIN, requireAdmin, ROLE_AREAS, type Role, type RoleDefinition } from "@/lib/admin-auth";
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
  Pager,
  paginate,
  panelClass,
  panelTitleClass,
  quietButtonClass,
} from "../ui";
import {
  createRoleAction,
  createUserAction,
  deleteRoleAction,
  deleteUserAction,
  resetUserPasswordAction,
  resetUserTotpAction,
  saveRoleAction,
  updateUserAction,
} from "../user-actions";

type UsersPageProps = { searchParams: Promise<{ greska?: string; ok?: string; strana?: string }> };

const smallButton =
  "inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-full px-[16px] font-display text-[13.5px] font-bold whitespace-nowrap text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-colors duration-300 hover:bg-band";

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const t = await getPanelT();
  const current = await requireAdmin("users");
  const [{ greska, ok, strana }, users, settings, roles] = await Promise.all([searchParams, listAdmins(), getSettings(), getRoles()]);
  const list = paginate(users, strana);
  const { orderDate } = dateFormats(settings.store);

  // Šta uloga vidi, rečima: „Prodaja, Katalog, Popusti".
  const summary = (role: RoleDefinition) =>
    role.id === OWNER_ROLE.id ? t("sve, uključujući korisnike i uloge") : role.areas.map((area) => t(areaLabels[area].label)).join(", ") || t("samo svoj nalog");
  const roleSelect = (value: Role) => (
    <select name="role" defaultValue={roles.some((role) => role.id === value) ? value : (roles[1] ?? OWNER_ROLE).id} className={inputClass}>
      {roles.map((role) => (
        <option key={role.id} value={role.id}>
          {t(role.name)} — {summary(role)}
        </option>
      ))}
    </select>
  );
  // Polja za delove panela u formi uloge.
  const areaBoxes = (role?: RoleDefinition) => (
    <div className="grid gap-[8px] sm:grid-cols-2">
      {ROLE_AREAS.map((area) => (
        <label key={area} className="flex cursor-pointer items-start gap-[10px] rounded-[14px] bg-white px-[12px] py-[10px] text-[14.5px] has-checked:shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
          <Checkbox name="areas" value={area} defaultChecked={role?.areas.includes(area)} />
          <span className="flex flex-col">
            <span className="font-display font-bold">{t(areaLabels[area].label)}</span>
            <span className="text-[13px] text-muted">{t(areaLabels[area].hint)}</span>
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        title={t("Korisnici")}
        hint={t("Ko sme u panel i šta sme da radi. Svaki korisnik ima ulogu; uloga određuje koje delove panela vidi. Vlasnik vidi sve i jedini upravlja korisnicima i ulogama.")}
        error={greska}
        notice={ok}
      />

      <div className="flex flex-col gap-[16px]">
        {/* Uloge, kao „Staff permissions" u Shopify-ju: naziv i delovi panela koje uloga vidi. */}
        <section className={panelClass}>
          <h2 className={panelTitleClass}>{t("Uloge")}</h2>
          <p className="mt-[-8px] text-[14px] text-muted">
            {t("Napravite ulogu za svaki posao (npr. Magacin, Podrška kupcima) i označite šta sme da vidi. Izmena važi odmah za sve korisnike sa tom ulogom.")}
          </p>
          <div className="flex flex-col">
            {roles.map((role) => {
              const count = users.filter((user) => user.role === role.id).length;
              return (
                <div key={role.id} className="border-t border-line py-[12px] first:border-t-0">
                  <div className="flex flex-wrap items-center gap-[10px]">
                    <span className="font-display text-[16px] font-bold">{t(role.name)}</span>
                    <span className="text-[14px] text-muted">
                      {summary(role)} · {t("korisnika: {a}", { a: count })}
                    </span>
                  </div>
                  {role.id !== OWNER_ROLE.id && (
                    <details className="mt-[8px]">
                      <summary className="cursor-pointer font-display text-[14px] font-bold">{t("Izmeni ulogu")}</summary>
                      <div className="mt-[10px] flex flex-col gap-[10px] rounded-[18px] bg-band p-[14px]">
                        <form action={saveRoleAction} className="flex flex-col gap-[10px]">
                          <input type="hidden" name="id" value={role.id} />
                          <label className={`${labelClass} max-w-[360px]`}>
                            {t("Naziv uloge")}
                            <input name="name" required maxLength={60} defaultValue={role.name} className={inputClass} />
                          </label>
                          {areaBoxes(role)}
                          <div className="flex flex-wrap gap-[8px]">
                            <button type="submit" className={buttonClass}>
                              {t("Sačuvaj ulogu")}
                            </button>
                          </div>
                        </form>
                        <form action={deleteRoleAction}>
                          <input type="hidden" name="id" value={role.id} />
                          <ConfirmButton question={t("Obrisati ulogu „{a}\"?", { a: role.name })} className={smallButton}>
                            {t("Obriši ulogu")}
                          </ConfirmButton>
                        </form>
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
          <details className="border-t border-line pt-[12px]">
            <summary className="cursor-pointer font-display text-[15px] font-bold">{t("+ Nova uloga")}</summary>
            <form action={createRoleAction} className="mt-[10px] flex flex-col gap-[10px] rounded-[18px] bg-band p-[14px]">
              <label className={`${labelClass} max-w-[360px]`}>
                {t("Naziv uloge")}
                <input name="name" required maxLength={60} placeholder={t("npr. Magacin")} className={inputClass} />
              </label>
              {areaBoxes()}
              <div>
                <button type="submit" className={buttonClass}>
                  {t("Dodaj ulogu")}
                </button>
              </div>
            </form>
          </details>
        </section>

        {/* Novi korisnik je iznad spiska, da se ne skroluje do dna. */}
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
            <label className={labelClass}>
              {t("Email za novu lozinku")}
              <input name="email" type="email" maxLength={191} className={inputClass} />
            </label>
          </div>
          <div className={fieldRowClass}>
            <label className={labelClass}>
              {t("Uloga")}
              {roleSelect((roles[1] ?? OWNER_ROLE).id)}
            </label>
            <label className={labelClass}>
              {t("Lozinka (najmanje")} {PASSWORD_MIN} {t("znakova)")}
              <input name="password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} className={inputClass} />
            </label>
          </div>
          <div>
            <button type="submit" className={buttonClass}>
              {t("Dodaj korisnika")}
            </button>
          </div>
        </form>
        {list.shown.map((user) => (
          <div key={user.id} className={`${cardClass} flex flex-col gap-[14px]`}>
            <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
              <h2 className="text-[19px]">
                {user.name} <span className="font-sans text-[15px] font-normal text-muted">· {user.username}</span>
                {user.id === current.id && <span className="font-sans text-[15px] font-normal text-muted"> {t("· vi")}</span>}
              </h2>
              <span className="text-[14px] text-muted">
                {user.disabled ? t("isključen · ") : ""}
                {user.totpEnabled ? "prijava u dva koraka · " : ""}
                {user.lastLoginAt ? t("poslednja prijava {a}", { a: orderDate(user.lastLoginAt) }) : t("još se nije prijavio")}
              </span>
            </div>
            <form action={updateUserAction} className="flex flex-wrap items-end gap-[12px]">
              <input type="hidden" name="id" value={user.id} />
              <label className={`${labelClass} min-w-[180px] grow basis-0`}>
                {t("Ime")}
                <input name="name" required maxLength={100} defaultValue={user.name} className={inputClass} />
              </label>
              <label className={`${labelClass} min-w-[200px] grow basis-0`}>
                {t("Email za novu lozinku")}
                <input name="email" type="email" maxLength={191} defaultValue={user.email} className={inputClass} />
              </label>
              <label className={`${labelClass} min-w-[240px] grow-[2] basis-0`}>
                {t("Uloga")}
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
                    {t("Nova lozinka (najmanje")} {PASSWORD_MIN} {t("znakova)")}
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
                    <ConfirmButton question={t("Isključiti prijavu u dva koraka za {a}?", { a: user.username })} tone="default" className={quietButtonClass}>
                      {t("Isključi dva koraka")}
                    </ConfirmButton>
                  </form>
                )}
                {user.id !== current.id && (
                  <form action={deleteUserAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <input type="hidden" name="username" value={user.username} />
                    <ConfirmButton question={t("Obrisati korisnika {a}?", { a: user.username })} className={quietButtonClass}>
                      {t("Obriši")}
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </details>
          </div>
        ))}
        {list.pages > 1 && (
          <Pager path={`${ADMIN_PATH}/korisnici`} page={list.page} pages={list.pages} summary={t("Korisnika: {a}", { a: users.length })} />
        )}

      </div>
    </>
  );
}
