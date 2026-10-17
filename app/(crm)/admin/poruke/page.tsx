import { getPanelT } from "@/lib/i18n/server";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { getMessages } from "@/lib/storefront/inbox";
import { deleteMessageAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { dateFormats } from "../order-ui";
import { cardClass, PageHeader, Pager, paginate, quietButtonClass, rowClass } from "../ui";

type MessagesPageProps = { searchParams: Promise<{ greska?: string; ok?: string; strana?: string }> };

const PATH = `${ADMIN_PATH}/poruke`;

/** Poruke → Kontakt forma: poruke koje kupci šalju sa sajta. Novosti i prijavljeni su na svojim stranicama. */
export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const t = await getPanelT();
  await requireAdmin("orders");
  const [{ greska, ok, strana }, messages, settings] = await Promise.all([searchParams, getMessages(), getSettings()]);
  const { orderDate } = dateFormats(settings.store);
  const list = paginate(messages, strana);
  // Posle brisanja panel ostaje na istoj strani.
  const back = `${PATH}${list.page > 1 ? `?strana=${list.page}` : ""}`;

  return (
    <>
      <PageHeader
        title={t("Kontakt forma")}
        hint={t("Poruke koje kupci šalju sa sajta, najnovije prve. Odgovarate iz svog programa za email: klik na adresu otvara novu poruku.")}
        error={greska}
        notice={ok}
      />
      <div className={cardClass}>
        {messages.length === 0 ? (
          <p className="text-[15px] text-muted">{t("Još nema poruka.")}</p>
        ) : (
          list.shown.map((message) => (
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
                <input type="hidden" name="back" value={back} />
                <ConfirmButton question={t("Obrisati ovu poruku?")} className={quietButtonClass}>
                  {t("Obriši")}
                </ConfirmButton>
              </form>
            </div>
          ))
        )}
      </div>
      {messages.length > 0 && <Pager path={PATH} page={list.page} pages={list.pages} summary={t("Poruka: {a}", { a: messages.length })} />}
    </>
  );
}
