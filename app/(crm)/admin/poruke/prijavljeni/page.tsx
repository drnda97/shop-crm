import { getPanelT } from "@/lib/i18n/server";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { getSubscribers } from "@/lib/storefront/inbox";
import { dateFormats } from "../../order-ui";
import { cardClass, PageHeader, Pager, paginate, quietButtonClass, rowClass } from "../../ui";

type SubscribersPageProps = { searchParams: Promise<{ strana?: string }> };

const PATH = `${ADMIN_PATH}/poruke/prijavljeni`;

/** Poruke → Prijavljeni: adrese prijavljene na novosti, sa odjavljenima, i preuzimanje u CSV-u. */
export default async function SubscribersPage({ searchParams }: SubscribersPageProps) {
  const t = await getPanelT();
  await requireAdmin("orders");
  const [{ strana }, subscribers, settings] = await Promise.all([searchParams, getSubscribers(), getSettings()]);
  const active = subscribers.filter((subscriber) => !subscriber.unsubscribed).length;
  const { orderDate } = dateFormats(settings.store);
  const list = paginate(subscribers, strana);

  return (
    <>
      <PageHeader
        title={t("Prijavljeni na novosti")}
        hint={t("Prijavljenih: {a}, odjavljenih: {b}. Odjavljenima se novosti više ne šalju.", { a: active, b: subscribers.length - active })}
        action={
          <a href={`${ADMIN_PATH}/poruke/izvoz`} className={quietButtonClass}>
            {t("Preuzmi CSV")}
          </a>
        }
      />
      <div className={cardClass}>
        {list.shown.map((subscriber) => (
          <div key={subscriber.email} className={`${rowClass} justify-between text-[15px]`}>
            <span className={subscriber.unsubscribed ? "text-muted line-through" : undefined}>{subscriber.email}</span>
            <span className="text-[13px] text-muted">
              {subscriber.unsubscribed ? t("odjavljen · ") : ""}
              {orderDate(subscriber.createdAt)}
            </span>
          </div>
        ))}
        {subscribers.length === 0 && <p className="text-[15px] text-muted">{t("Još nema prijavljenih.")}</p>}
      </div>
      {subscribers.length > 0 && <Pager path={PATH} page={list.page} pages={list.pages} summary={t("Adresa: {a}", { a: subscribers.length })} />}
    </>
  );
}
