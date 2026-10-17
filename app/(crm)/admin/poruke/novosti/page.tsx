import { getPanelT } from "@/lib/i18n/server";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { isMailReady } from "@/lib/mail";
import { getCampaigns } from "@/lib/newsletter";
import { getSubscribers } from "@/lib/storefront/inbox";
import { sendCampaignAction } from "../../actions";
import { ConfirmButton } from "../../confirm-button";
import { dateFormats } from "../../order-ui";
import { buttonClass, cardClass, inputClass, labelClass, MailNotice, PageHeader, Pager, paginate } from "../../ui";

type NewsletterPageProps = { searchParams: Promise<{ greska?: string; ok?: string; strana?: string }> };

const PATH = `${ADMIN_PATH}/poruke/novosti`;

/** Poruke → Novosti: poruka svim prijavljenima i spisak poslatih. */
export default async function NewsletterPage({ searchParams }: NewsletterPageProps) {
  const t = await getPanelT();
  await requireAdmin("orders");
  const [{ greska, ok, strana }, subscribers, settings, campaigns] = await Promise.all([
    searchParams,
    getSubscribers(),
    getSettings(),
    getCampaigns(),
  ]);
  const active = subscribers.filter((subscriber) => !subscriber.unsubscribed);
  const { orderDate } = dateFormats(settings.store);
  const sent = paginate(campaigns, strana);

  return (
    <>
      <PageHeader
        title={t("Novosti")}
        hint={t("Poruka svim prijavljenima na novosti, sa linkom za odjavu na dnu. Prijavljenih: {a}.", { a: active.length })}
        error={greska}
        notice={ok}
      />
      <MailNotice configured={isMailReady(settings)} settingsPath={`${ADMIN_PATH}/podesavanja/email`} />
      <div className="grid items-start gap-[16px] xl:grid-cols-2">
        <form action={sendCampaignAction} className={`${cardClass} flex flex-col gap-[14px]`}>
          <h2 className="text-[20px]">{t("Nova poruka")}</h2>
          <label className={labelClass}>
            {t("Naslov")}
            <input name="subject" required maxLength={200} className={inputClass} />
          </label>
          <label className={labelClass}>
            {t("Tekst — prazan red razdvaja pasuse")}
            <textarea name="body" required maxLength={10000} className={`${inputClass} min-h-[220px]`} />
          </label>
          <div>
            <ConfirmButton question={t("Poslati poruku na {a} adresa?", { a: active.length })} tone="default" className={buttonClass}>
              {t("Pošalji svima")}
            </ConfirmButton>
          </div>
          <p className="text-[14px] text-muted">
            {t("Poruka ide svakom prijavljenom posebno, sa linkom za odjavu na dnu. Šalje se preko vašeg SMTP naloga, pa proverite koliko poruka na sat vaš hosting dozvoljava.")}
          </p>
        </form>
        <div className={cardClass}>
          <h2 className="mb-[8px] text-[20px]">{t("Poslate poruke")}</h2>
          {campaigns.length === 0 ? (
            <p className="text-[15px] text-muted">{t("Još nema poslatih poruka.")}</p>
          ) : (
            sent.shown.map((campaign) => (
              <div key={campaign.id} className="border-t border-line py-[10px] text-[15px] first:border-t-0">
                <div className="font-display font-bold">{campaign.subject}</div>
                <div className="text-[13.5px] text-muted">
                  {orderDate(campaign.createdAt)} {t("· poslato")} {campaign.sent} {t("od")} {campaign.recipients}
                  {campaign.failed > 0 && ` · neuspelo ${campaign.failed}`}
                  {!campaign.finished && " · slanje u toku"}
                </div>
              </div>
            ))
          )}
          {sent.pages > 1 && <Pager path={PATH} page={sent.page} pages={sent.pages} summary={t("Poslatih: {a}", { a: campaigns.length })} />}
        </div>
      </div>
    </>
  );
}
