import { getPanelT } from "@/lib/i18n/server";
import { listCarts } from "@/lib/abandoned";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getProducts, getSettings } from "@/lib/content";
import { formatMoney } from "@/lib/format";
import { isMailConfigured } from "@/lib/order-email";
import { currencyOf } from "@/lib/settings";
import { saveAbandonedAction, sendRemindersAction } from "../actions";
import { dateFormats } from "../order-ui";
import {
  buttonClass,
  cardClass,
  Checkbox,
  inputClass,
  labelClass,
  MailNotice,
  PageHeader,
  panelClass,
  panelTitleClass,
  quietButtonClass,
} from "../ui";

type CartsPageProps = { searchParams: Promise<{ greska?: string; ok?: string }> };

export default async function CartsPage({ searchParams }: CartsPageProps) {
  const t = await getPanelT();
  await requireAdmin("orders");
  const { greska, ok } = await searchParams;
  const [carts, settings, products] = await Promise.all([listCarts(), getSettings(), getProducts()]);
  const { abandoned } = settings;
  const currency = currencyOf(settings);
  const { orderDate } = dateFormats(settings.store);
  const name = (slug: string) => products.find((product) => product.slug === slug)?.name ?? slug;

  return (
    <>
      <PageHeader
        title={t("Napuštene korpe")}
        hint={t("Kupac koji na stranici plaćanja upiše email, a ne poruči, može da dobije jedan podsetnik sa linkom koji mu vraća korpu. Korpa se briše kada kupac poruči, a najkasnije posle 30 dana.")}
        error={greska}
        notice={ok}
      />
      <MailNotice configured={isMailConfigured(settings)} settingsPath={`${ADMIN_PATH}/podesavanja`} />

      <div className="grid items-start gap-[16px] xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <form action={saveAbandonedAction} className={panelClass}>
          <h2 className={panelTitleClass}>{t("Podsetnik")}</h2>
          <label className="flex cursor-pointer items-center gap-[10px] text-[15px]">
            <Checkbox name="enabled" defaultChecked={abandoned.enabled} />
            {t("Šalji podsetnik za napuštenu korpu")}
          </label>
          <p className="mt-[-8px] text-[14px] text-muted">
            {t("Dok je isključeno, email sa stranice plaćanja se ne čuva. Kada je uključeno, kupac ispod polja za email vidi da mu šaljemo jedan podsetnik, a u poruci ima link za odjavu. Proverite da li vam je za takvu poruku potreban pristanak kupca.")}
          </p>
          <label className={labelClass}>
            {t("Posle koliko sati bez porudžbine")}
            <input name="delayHours" type="number" min="1" max="168" step="1" required defaultValue={abandoned.delayHours} className={inputClass} />
          </label>
          <label className={labelClass}>
            {t("Naslov poruke")}
            <input name="subject" maxLength={200} defaultValue={abandoned.subject} className={inputClass} />
          </label>
          <label className={labelClass}>
            {t("Tekst")}
            <textarea name="text" maxLength={2000} defaultValue={abandoned.text} className={`${inputClass} min-h-[110px]`} />
            <span className="font-sans text-[14px] font-normal text-muted">
              {"{ime}"} i {"{prodavnica}"} se menjaju podacima. Ispod teksta idu proizvodi iz korpe i dugme za
              povratak na plaćanje.
            </span>
          </label>
          <div>
            <button type="submit" className={buttonClass}>
              {t("Sačuvaj")}
            </button>
          </div>
        </form>

        <div className={cardClass}>
          <div className="mb-[8px] flex flex-wrap items-center justify-between gap-[12px]">
            <h2 className={panelTitleClass}>Korpe ({carts.length})</h2>
            <form action={sendRemindersAction}>
              <button type="submit" className={quietButtonClass} disabled={!abandoned.enabled || !isMailConfigured(settings)}>
                {t("Pošalji podsetnike sada")}
              </button>
            </form>
          </div>
          <p className="mb-[8px] text-[14px] text-muted">
            {t("Podsetnici se šalju sami, na svakih desetak minuta dok server radi. Dugme šalje odmah one kojima je vreme.")}
          </p>
          {carts.map((cart) => (
            <div key={cart.token} className="flex flex-wrap items-baseline justify-between gap-x-[16px] gap-y-[2px] border-t border-line py-[10px] text-[15px]">
              <div className="min-w-[220px] grow">
                <div className="font-display font-bold">
                  {cart.firstName ? `${cart.firstName} · ` : ""}
                  <a href={`mailto:${cart.email}`} className="underline">
                    {cart.email}
                  </a>
                </div>
                <div className="text-[14px] text-muted">
                  {cart.items.map((item) => `${item.qty} × ${name(item.slug)}`).join(", ")}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold">{formatMoney(cart.value, currency)}</div>
                <div className="text-[14px] text-muted">
                  {orderDate(cart.updatedAt)}
                  {cart.unsubscribed ? " · odjavljen" : cart.remindedAt ? " · podsetnik poslat" : " · čeka"}
                </div>
              </div>
            </div>
          ))}
          {carts.length === 0 && <p className="text-[15px] text-muted">{t("Nema napuštenih korpi.")}</p>}
        </div>
      </div>
    </>
  );
}
