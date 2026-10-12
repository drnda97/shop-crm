import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { formatMoney, fromMinor } from "@/lib/format";
import { isMailConfigured } from "@/lib/order-email";
import { getOrder, getOrderEvents } from "@/lib/order-store";
import { itemName, refundable } from "@/lib/orders";
import { currencyOf } from "@/lib/settings";
import {
  refundOrderAction,
  saveOrderCustomerAction,
  saveTrackingAction,
  setOrderPaidAction,
} from "../../actions";
import { OrderCard } from "../../order-card";
import { dateFormats } from "../../order-ui";
import {
  buttonClass,
  cardClass,
  ErrorNote,
  fieldRowClass,
  inputClass,
  labelClass,
  MailNotice,
  panelClass,
  panelTitleClass,
  quietButtonClass,
  textLinkClass,
} from "../../ui";

type OrderPageProps = {
  params: Promise<{ broj: string }>;
  searchParams: Promise<{ greska?: string }>;
};

/** Jedna porudžbina: dostava i praćenje, uplata i povraćaj, podaci kupca, račun i istorija. */
export default async function OrderPage({ params, searchParams }: OrderPageProps) {
  await requireAdmin();
  const [{ broj }, { greska }] = await Promise.all([params, searchParams]);
  const [order, events, settings] = await Promise.all([getOrder(broj), getOrderEvents(broj), getSettings()]);
  if (!order) notFound();

  const currency = currencyOf(settings);
  const { orderDate } = dateFormats(settings.store);
  const path = `${ADMIN_PATH}/porudzbine/${order.number}`;
  const left = refundable(order);

  return (
    <>
      <div className="mb-[16px] flex flex-wrap items-center justify-between gap-[12px]">
        <Link href={`${ADMIN_PATH}/porudzbine`} className={textLinkClass}>
          ← Porudžbine
        </Link>
        <a href={`${path}/racun`} target="_blank" rel="noreferrer" className={quietButtonClass}>
          Račun (PDF)
        </a>
      </div>
      <ErrorNote message={greska} />
      <MailNotice configured={isMailConfigured(settings)} settingsPath={`${ADMIN_PATH}/podesavanja`} />

      <div className="flex flex-col gap-[16px]">
        <OrderCard order={order} currency={currency} date={orderDate(order.receivedAt)} back={path} detail />

        <div className="grid items-start gap-[16px] xl:grid-cols-2">
          <form action={saveTrackingAction} className={panelClass}>
            <h2 className={panelTitleClass}>Dostava i praćenje</h2>
            <p className="mt-[-8px] text-[14.5px] text-muted">
              {order.deliveryMethod || "Dostava"}. Broj pošiljke i link kupac dobija u emailu kada porudžbinu
              označite kao poslatu, pa ih upišite pre toga.
            </p>
            <input type="hidden" name="number" value={order.number} />
            <div className={fieldRowClass}>
              <label className={labelClass}>
                Broj pošiljke
                <input name="trackingNumber" maxLength={100} defaultValue={order.tracking?.number} className={inputClass} />
              </label>
              <label className={labelClass}>
                Adresa za praćenje
                <input
                  name="trackingUrl"
                  type="url"
                  maxLength={500}
                  placeholder="https://…"
                  defaultValue={order.tracking?.url}
                  className={inputClass}
                />
              </label>
            </div>
            <div>
              <button type="submit" className={buttonClass}>
                Sačuvaj praćenje
              </button>
            </div>
          </form>

          <div className={panelClass}>
            <h2 className={panelTitleClass}>Uplata i povraćaj</h2>
            <p className="mt-[-8px] text-[15px]">
              {order.paidAt ? `Plaćeno ${orderDate(order.paidAt)}` : "Nije označeno kao plaćeno"}
              {order.paymentRef && <span className="text-muted"> · {order.paymentRef}</span>}
              {order.refunded > 0 && ` · vraćeno ${formatMoney(order.refunded, currency)}`}
            </p>
            <form action={setOrderPaidAction}>
              <input type="hidden" name="number" value={order.number} />
              <input type="hidden" name="paid" value={order.paidAt ? "no" : "yes"} />
              <button type="submit" className={quietButtonClass}>
                {order.paidAt ? "Ukloni oznaku plaćeno" : "Označi kao plaćeno"}
              </button>
            </form>
            {left > 0 && (
              <form action={refundOrderAction} className="flex flex-col gap-[12px] border-t border-line pt-[16px]">
                <input type="hidden" name="number" value={order.number} />
                <div className={fieldRowClass}>
                  <label className={labelClass}>
                    Iznos povraćaja ({currency.code})
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step={currency.decimals === 0 ? "1" : "0.01"}
                      max={fromMinor(left, currency.decimals)}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Razlog
                    <input name="reason" maxLength={300} className={inputClass} />
                  </label>
                </div>
                {order.items.some((item) => item.returned < item.qty) && (
                  <fieldset className="flex flex-col gap-[8px]">
                    <legend className={`${labelClass} mb-[8px]`}>Vraćena roba — koliko komada se vraća na stanje</legend>
                    {order.items.map((item, position) =>
                      item.returned < item.qty ? (
                        <label key={position} className="flex items-center gap-[10px] text-[15px]">
                          <span className="w-[76px] shrink-0">
                            <input
                              name={`returned-${position}`}
                              type="number"
                              min="0"
                              max={item.qty - item.returned}
                              step="1"
                              defaultValue="0"
                              aria-label={`Vraćeno komada: ${itemName(item)}`}
                              className={inputClass}
                            />
                          </span>
                          od {item.qty - item.returned} × {itemName(item)}
                        </label>
                      ) : null,
                    )}
                  </fieldset>
                )}
                <div>
                  <button type="submit" className={quietButtonClass}>
                    Upiši povraćaj
                  </button>
                </div>
                <p className="text-[14px] text-muted">
                  Može da se vrati još {formatMoney(left, currency)}. Iznos se oduzima od prodaje u Pregledu, a kupac
                  dobija email o povraćaju. Novac vraćate sami, osim kada je porudžbina plaćena karticom preko
                  procesora koji to ume. Vraćeni komadi idu na stanje tamo gde se broj komada vodi.
                </p>
              </form>
            )}
          </div>

          <form action={saveOrderCustomerAction} className={panelClass}>
            <h2 className={panelTitleClass}>Podaci kupca</h2>
            <input type="hidden" name="number" value={order.number} />
            <div className={fieldRowClass}>
              <label className={labelClass}>
                Ime i prezime
                <input name="name" required defaultValue={order.customer.name} className={inputClass} />
              </label>
              <label className={labelClass}>
                Telefon
                <input name="phone" required defaultValue={order.customer.phone} className={inputClass} />
              </label>
            </div>
            <label className={labelClass}>
              Email
              <input name="email" type="email" required defaultValue={order.customer.email} className={inputClass} />
            </label>
            <label className={labelClass}>
              Ulica i broj
              <input name="street" required defaultValue={order.customer.street} className={inputClass} />
            </label>
            <div className={fieldRowClass}>
              <label className={labelClass}>
                Poštanski broj
                <input name="postalCode" required defaultValue={order.customer.postalCode} className={inputClass} />
              </label>
              <label className={labelClass}>
                Mesto
                <input name="city" required defaultValue={order.customer.city} className={inputClass} />
              </label>
            </div>
            <label className={labelClass}>
              Napomena kupca
              <input name="note" maxLength={500} defaultValue={order.customer.note} className={inputClass} />
            </label>
            <div>
              <button type="submit" className={buttonClass}>
                Sačuvaj podatke
              </button>
            </div>
          </form>

          <div className={cardClass}>
            <h2 className={panelTitleClass}>Istorija</h2>
            <ul className="mt-[10px] flex flex-col">
              {events.map((event, index) => (
                <li key={index} className="flex flex-wrap justify-between gap-x-[16px] border-t border-line py-[8px] text-[15px] first:border-t-0">
                  <span>{event.text}</span>
                  <span className="text-[14px] text-muted">{orderDate(event.at)}</span>
                </li>
              ))}
              {events.length === 0 && (
                <li className="text-[15px] text-muted">Istorija se vodi za porudžbine primljene posle uvođenja ove stranice.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
