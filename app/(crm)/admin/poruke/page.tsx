import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { isMailReady } from "@/lib/mail";
import { getCampaigns } from "@/lib/newsletter";
import { getMessages, getSubscribers } from "@/lib/storefront/inbox";
import { deleteMessageAction, sendCampaignAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { dateFormats } from "../order-ui";
import { buttonClass, cardClass, inputClass, labelClass, MailNotice, PageHeader, quietButtonClass, rowClass } from "../ui";

const sectionTitle = "mb-[14px] text-[22px]";

type MessagesPageProps = { searchParams: Promise<{ greska?: string; ok?: string }> };

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  await requireAdmin();
  const [{ greska, ok }, messages, subscribers, settings, campaigns] = await Promise.all([
    searchParams,
    getMessages(),
    getSubscribers(),
    getSettings(),
    getCampaigns(),
  ]);
  const active = subscribers.filter((subscriber) => !subscriber.unsubscribed);
  const { orderDate } = dateFormats(settings.store);

  return (
    <>
      <PageHeader
        title="Poruke"
        hint="Poruke iz kontakt forme na sajtu i novosti: poruka svim prijavljenima. Na poruku iz kontakt forme odgovarate iz svog programa za email."
        error={greska}
        notice={ok}
      />

      <section className="mb-[32px]">
        <h2 className={sectionTitle}>Kontakt forma ({messages.length})</h2>
        <div className={cardClass}>
          {messages.length === 0 ? (
            <p className="text-[15px] text-muted">Još nema poruka.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`${rowClass} items-start`}>
                <div className="min-w-0 grow basis-[320px] text-[15px]">
                  <div>
                    <span className="font-medium">{message.name}</span>{" "}
                    <a href={`mailto:${message.email}`} className="text-muted underline">
                      {message.email}
                    </a>
                  </div>
                  <div className="text-[13px] text-muted">
                    {orderDate(message.createdAt)} · {message.topic}
                  </div>
                  <p className="mt-[6px] whitespace-pre-wrap">{message.body}</p>
                </div>
                <form action={deleteMessageAction}>
                  <input type="hidden" name="id" value={message.id} />
                  <ConfirmButton question="Obrisati ovu poruku?" className={quietButtonClass}>
                    Obriši
                  </ConfirmButton>
                </form>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="mb-[14px] flex flex-wrap items-center justify-between gap-[12px]">
          <h2 className="text-[22px]">Novosti ({active.length} prijavljenih)</h2>
          <a href={`${ADMIN_PATH}/poruke/izvoz`} className={quietButtonClass}>
            Preuzmi CSV
          </a>
        </div>
        <MailNotice configured={isMailReady(settings)} settingsPath={`${ADMIN_PATH}/podesavanja`} />
        <div className="grid items-start gap-[16px] xl:grid-cols-2">
          <form action={sendCampaignAction} className={`${cardClass} flex flex-col gap-[14px]`}>
            <h3 className="text-[18px]">Nova poruka</h3>
            <label className={labelClass}>
              Naslov
              <input name="subject" required maxLength={200} className={inputClass} />
            </label>
            <label className={labelClass}>
              Tekst — prazan red razdvaja pasuse
              <textarea name="body" required maxLength={10000} className={`${inputClass} min-h-[180px]`} />
            </label>
            <div>
              <ConfirmButton question={`Poslati poruku na ${active.length} adresa?`} className={buttonClass}>
                Pošalji svima
              </ConfirmButton>
            </div>
            <p className="text-[14px] text-muted">
              Poruka ide svakom prijavljenom posebno, sa linkom za odjavu na dnu. Šalje se preko vašeg SMTP
              naloga, pa proverite koliko poruka na sat vaš hosting dozvoljava.
            </p>
          </form>
          <div className={cardClass}>
            <h3 className="mb-[8px] text-[18px]">Poslate poruke</h3>
            {campaigns.length === 0 ? (
              <p className="text-[15px] text-muted">Još nema poslatih poruka.</p>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="border-t border-line py-[10px] text-[15px] first:border-t-0">
                  <div className="font-display font-bold">{campaign.subject}</div>
                  <div className="text-[13.5px] text-muted">
                    {orderDate(campaign.createdAt)} · poslato {campaign.sent} od {campaign.recipients}
                    {campaign.failed > 0 && ` · neuspelo ${campaign.failed}`}
                    {!campaign.finished && " · slanje u toku"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <details className={`${cardClass} mt-[16px]`}>
          <summary className="cursor-pointer font-display text-[15px] font-bold">Spisak adresa ({subscribers.length})</summary>
          <div className="mt-[10px]">
            {subscribers.map((subscriber) => (
              <div key={subscriber.email} className={`${rowClass} justify-between text-[15px]`}>
                <span className={subscriber.unsubscribed ? "text-muted line-through" : undefined}>{subscriber.email}</span>
                <span className="text-[13px] text-muted">
                  {subscriber.unsubscribed ? "odjavljen · " : ""}
                  {orderDate(subscriber.createdAt)}
                </span>
              </div>
            ))}
            {subscribers.length === 0 && <p className="text-[15px] text-muted">Još nema prijavljenih.</p>}
          </div>
        </details>
      </section>
    </>
  );
}
