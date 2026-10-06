import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { getMessages, getSubscribers } from "@/lib/storefront/inbox";
import { deleteMessageAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { dateFormats } from "../order-ui";
import { cardClass, PageHeader, quietButtonClass, rowClass } from "../ui";

const sectionTitle = "mb-[14px] text-[22px]";

export default async function MessagesPage() {
  await requireAdmin();
  const [messages, subscribers, settings] = await Promise.all([
    getMessages(),
    getSubscribers(),
    getSettings(),
  ]);
  const { orderDate } = dateFormats(settings.store);

  return (
    <>
      <PageHeader
        title="Poruke"
        hint="Poruke iz kontakt forme na sajtu i adrese prijavljene na novosti. Na poruku odgovarate iz svog programa za email."
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
        <h2 className={sectionTitle}>Prijavljeni na novosti ({subscribers.length})</h2>
        <div className={cardClass}>
          {subscribers.length === 0 ? (
            <p className="text-[15px] text-muted">Još nema prijavljenih.</p>
          ) : (
            subscribers.map((subscriber) => (
              <div key={subscriber.email} className={`${rowClass} justify-between text-[15px]`}>
                <span>{subscriber.email}</span>
                <span className="text-[13px] text-muted">{orderDate(subscriber.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
