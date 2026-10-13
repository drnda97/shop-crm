import { getPanelT } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { listApiKeys, listWebhooks, scopeLabels, webhookEvents } from "@/lib/integrations";
import { ConfirmButton } from "../confirm-button";
import { dateFormats } from "../order-ui";
import { buttonClass, Checkbox, inputClass, labelClass, PageHeader, panelClass, panelTitleClass, quietButtonClass } from "../ui";
import { createWebhookAction, saveAccessAction, deleteApiKeyAction, deleteWebhookAction, testWebhookAction, toggleWebhookAction } from "../user-actions";
import { KeyForm } from "./key-form";

type IntegrationsPageProps = { searchParams: Promise<{ greska?: string; ok?: string }> };

/** Veza sa spoljnim sistemima: API ključevi i webhook-ovi. Samo za vlasnika. */
export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const t = await getPanelT();
  await requireAdmin("settings");
  const [{ greska, ok }, keys, webhooks, settings] = await Promise.all([searchParams, listApiKeys(), listWebhooks(), getSettings()]);
  const { orderDate } = dateFormats(settings.store);
  const { access } = settings;

  return (
    <>
      <PageHeader
        title={t("Integracije")}
        hint={t("Veza sa knjigovodstvom, magacinom ili kurirskom službom: ključ kojim spoljni sistem čita porudžbine, i adrese kojima panel javlja šta se desilo.")}
        error={greska}
        notice={ok}
      />
      <form action={saveAccessAction} className={`${panelClass} mb-[16px]`}>
        <h2 className={panelTitleClass}>{t("Pristup spolja")}</h2>
        <p className="mt-[-8px] text-[15px] text-muted">
          {t("Sve je isključeno dok ga vi ne uključite: bez toga niko van ove aplikacije ne može da čita podatke prodavnice. Prodavnica koja ide uz panel radi i kada je sve isključeno.")}
        </p>
        <label className="flex cursor-pointer items-start gap-[10px] text-[15px] leading-[22px]">
          <Checkbox name="publicApi" defaultChecked={access.publicApi} />
          {t("Javni API — sajt van ove aplikacije čita katalog i stranice i šalje porudžbine (/api/v1/…)")}
        </label>
        <label className="flex cursor-pointer items-start gap-[10px] text-[15px] leading-[22px]">
          <Checkbox name="adminApi" defaultChecked={access.adminApi} />
          {t("API sa ključem — spoljni sistem čita porudžbine i menja status i stanje (/api/v1/admin/…)")}
        </label>
        <label className="flex cursor-pointer items-start gap-[10px] text-[15px] leading-[22px]">
          <Checkbox name="webhooks" defaultChecked={access.webhooks} />
          {t("Webhook-ovi — panel javlja upisanim adresama šta se desilo sa porudžbinom")}
        </label>
        <div>
          <button type="submit" className={buttonClass}>
            {t("Sačuvaj pristup")}
          </button>
        </div>
      </form>

      <div className="grid items-start gap-[16px] xl:grid-cols-2">
        <div className={panelClass}>
          <h2 className={panelTitleClass}>{t("API ključevi")}</h2>
          <p className="mt-[-8px] text-[15px] text-muted">
            {t("Spoljni sistem šalje ključ u zaglavlju")} <code className="font-mono text-ink">Authorization: Bearer …</code> {t("na adrese")}{" "}
            <code className="font-mono text-ink">/api/v1/admin/…</code> {t("(spisak je u README-u). Ključ ne ide u kod sajta koji vidi kupac.")}
          </p>
          {keys.map((key) => (
            <div key={key.id} className="flex flex-wrap items-center justify-between gap-[10px] border-t border-line pt-[14px]">
              <div className="min-w-0">
                <div className="font-display text-[16px] font-bold">{key.name}</div>
                <div className="text-[14px] text-muted">
                  <span className="font-mono">{key.prefix}…</span> · {t(scopeLabels[key.scope])} ·{" "}
                  {key.lastUsedAt ? t("korišćen {a}", { a: orderDate(key.lastUsedAt) }) : t("još nije korišćen")}
                </div>
              </div>
              <form action={deleteApiKeyAction}>
                <input type="hidden" name="id" value={key.id} />
                <input type="hidden" name="name" value={key.name} />
                <ConfirmButton question={t("Obrisati ključ „{a}\"? Sistem koji ga koristi ostaje bez pristupa.", { a: key.name })} className={quietButtonClass}>
                  {t("Obriši")}
                </ConfirmButton>
              </form>
            </div>
          ))}
          <div className="border-t border-line pt-[16px]">
            <KeyForm scopes={scopeLabels} />
          </div>
        </div>

        <div className={panelClass}>
          <h2 className={panelTitleClass}>{t("Webhook-ovi")}</h2>
          <p className="mt-[-8px] text-[15px] text-muted">
            {t("Kada se desi izabrani događaj, panel na adresu šalje porudžbinu kao JSON. Poruka je potpisana tajnom (zaglavlje")} <code className="font-mono text-ink">X-ShopCRM-Signature</code>{t("), da primalac zna da je stigla odavde.")}
          </p>
          {webhooks.map((hook) => (
            <div key={hook.id} className="flex flex-col gap-[8px] border-t border-line pt-[14px]">
              <div className="font-display text-[15px] font-bold break-all">{hook.url}</div>
              <div className="text-[14px] text-muted">
                {hook.active ? "" : t("isključen · ")}
                {hook.events.map((event) => webhookEvents[event]).join(", ")}
              </div>
              <div className="text-[14px] text-muted">
                {t("Tajna:")} <span className="font-mono text-ink select-all">{hook.secret}</span>
              </div>
              <div className="text-[14px] text-muted">
                {hook.lastAt === null
                  ? t("Još ništa nije poslato.")
                  : hook.lastError
                    ? t("Poslednje slanje {a} nije uspelo: {b}", { a: orderDate(hook.lastAt), b: hook.lastError })
                    : t("Poslednje slanje {a}: uspelo ({b}).", { a: orderDate(hook.lastAt), b: hook.lastStatus ?? 0 })}
              </div>
              <div className="flex flex-wrap gap-[8px]">
                <form action={testWebhookAction}>
                  <input type="hidden" name="id" value={hook.id} />
                  <button type="submit" className={quietButtonClass}>
                    {t("Pošalji probu")}
                  </button>
                </form>
                <form action={toggleWebhookAction}>
                  <input type="hidden" name="id" value={hook.id} />
                  <input type="hidden" name="url" value={hook.url} />
                  <input type="hidden" name="active" value={hook.active ? "0" : "1"} />
                  <button type="submit" className={quietButtonClass}>
                    {hook.active ? t("Isključi") : t("Uključi")}
                  </button>
                </form>
                <form action={deleteWebhookAction}>
                  <input type="hidden" name="id" value={hook.id} />
                  <input type="hidden" name="url" value={hook.url} />
                  <ConfirmButton question={t("Obrisati ovaj webhook?")} className={quietButtonClass}>
                    {t("Obriši")}
                  </ConfirmButton>
                </form>
              </div>
            </div>
          ))}
          <form action={createWebhookAction} className="flex flex-col gap-[14px] border-t border-line pt-[16px]">
            <label className={labelClass}>
              {t("Adresa koja prima poruke")}
              <input name="url" type="url" required maxLength={500} placeholder={t("https://…")} className={inputClass} />
            </label>
            <div className="flex flex-col gap-[8px]">
              {Object.entries(webhookEvents).map(([event, label]) => (
                <label key={event} className="flex cursor-pointer items-center gap-[10px] text-[15px]">
                  <Checkbox name="events" value={event} defaultChecked />
                  {t(label)} <span className="font-mono text-[13px] text-muted">{event}</span>
                </label>
              ))}
            </div>
            <div>
              <button type="submit" className={buttonClass}>
                {t("Dodaj webhook")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
