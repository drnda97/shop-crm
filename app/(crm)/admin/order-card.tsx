import Link from "next/link";
import { ADMIN_PATH } from "@/lib/admin-auth";
import { discountText } from "@/lib/discounts";
import { formatMoney, type Currency } from "@/lib/format";
import { itemName, type Order, type OrderStatus } from "@/lib/orders";
import { paymentLabels } from "@/lib/settings";
import { saveOrderNoteAction, setOrderStatusAction } from "./actions";
import { StatusBadge } from "./order-ui";
import { cardClass, inputClass, quietButtonClass } from "./ui";

/** Šta sledeće može da se uradi sa porudžbinom u datom statusu. */
const nextSteps: Record<OrderStatus, { status: OrderStatus; label: string }[]> = {
  new: [
    { status: "confirmed", label: "Potvrdi" },
    { status: "shipped", label: "Označi kao poslatu" },
    { status: "cancelled", label: "Otkaži" },
  ],
  confirmed: [
    { status: "shipped", label: "Označi kao poslatu" },
    { status: "new", label: "Vrati u nove" },
    { status: "cancelled", label: "Otkaži" },
  ],
  shipped: [
    { status: "delivered", label: "Označi kao isporučenu" },
    { status: "confirmed", label: "Vrati u potvrđene" },
    { status: "cancelled", label: "Otkaži" },
  ],
  delivered: [
    { status: "shipped", label: "Vrati u poslate" },
    { status: "cancelled", label: "Otkaži" },
  ],
  cancelled: [{ status: "new", label: "Vrati u nove" }],
};

type OrderCardProps = {
  order: Order;
  currency: Currency;
  /** Datum porudžbine, već ispisan po podešavanjima prodavnice. */
  date: string;
  /** Adresa panela na koju se vraća posle izmene statusa ili beleške. */
  back: string;
  /** Na stranici kupca se njegovi podaci ne ponavljaju u svakoj porudžbini. */
  hideCustomer?: boolean;
  /** Kartica je na stranici same porudžbine, pa link „Detalji" nije potreban. */
  detail?: boolean;
};

export function OrderCard({ order, currency, date, back, hideCustomer = false, detail = false }: OrderCardProps) {
  const money = (value: number) => formatMoney(value, currency);

  return (
    <article className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <h2 className="text-[20px]">
          #{order.number}
          {!hideCustomer && (
            <>
              {" · "}
              <Link href={`${ADMIN_PATH}/kupci/${order.customerKey}`} className="underline">
                {order.customer.name}
              </Link>
            </>
          )}
        </h2>
        <div className="flex items-center gap-[10px] text-[14px] text-muted">
          {date}
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="mt-[12px] grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-[16px] text-[15px]">
        <div className="flex flex-col gap-[2px]">
          {!hideCustomer && (
            <>
              <a href={`tel:${order.customer.phone.replace(/[^+\d]/g, "")}`} className="underline">
                {order.customer.phone}
              </a>
              {order.customer.email && (
                <a href={`mailto:${order.customer.email}`} className="underline">
                  {order.customer.email}
                </a>
              )}
            </>
          )}
          <div>{order.customer.street}</div>
          <div>
            {order.customer.postalCode} {order.customer.city}
          </div>
          <div className="text-muted">
            {paymentLabels[order.paymentMethod]}
            {order.paidAt ? " · plaćeno" : order.paymentMethod !== "cod" ? " · čeka uplatu" : ""}
            {order.refunded > 0 && ` · vraćeno ${money(order.refunded)}`}
          </div>
          {order.deliveryMethod && <div className="text-muted">{order.deliveryMethod}</div>}
          {order.tracking && (
            <div className="text-muted">
              Pošiljka:{" "}
              {order.tracking.url ? (
                <a href={order.tracking.url} target="_blank" rel="noreferrer" className="underline">
                  {order.tracking.number}
                </a>
              ) : (
                order.tracking.number
              )}
            </div>
          )}
          {order.customer.note && (
            <div className="mt-[6px] text-muted">Napomena kupca: {order.customer.note}</div>
          )}
        </div>

        <div className="flex flex-col gap-[2px]">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between gap-[12px]">
              <span>
                {item.qty} × {itemName(item)}
                {item.sku && <span className="text-muted"> ({item.sku})</span>}
              </span>
              <span className="shrink-0 text-muted">{money(item.price * item.qty)}</span>
            </div>
          ))}
          {order.discount && (
            <div className="mt-[6px] flex justify-between gap-[12px] border-t border-line pt-[6px] text-muted">
              <span>{discountText(order.discount)}</span>
              <span>−{money(order.discount.amount)}</span>
            </div>
          )}
          <div
            className={`flex justify-between gap-[12px] text-muted ${order.discount ? "" : "mt-[6px] border-t border-line pt-[6px]"}`}
          >
            <span>{order.deliveryMethod || "Dostava"}</span>
            <span>{money(order.delivery)}</span>
          </div>
          <div className="flex justify-between gap-[12px] font-medium">
            <span>Ukupno</span>
            <span>{money(order.total)}</span>
          </div>
        </div>
      </div>

      {order.issuedCode && (
        <p className="mt-[12px] text-[14px] text-muted">
          Kupcu je poslat kod <span className="font-mono text-ink">{order.issuedCode.code}</span> za{" "}
          {order.issuedCode.percent}% popusta pri sledećoj kupovini
          {order.issuedCode.title && ` (${order.issuedCode.title})`}.
        </p>
      )}

      {order.emailError && (
        <p className="mt-[12px] rounded-[14px] bg-band px-[14px] py-[10px] text-[14px]">
          Email o ovoj porudžbini nije poslat ({order.emailError}). Proverite podešavanja emaila.
        </p>
      )}

      <form action={saveOrderNoteAction} className="mt-[12px] flex flex-wrap items-center gap-[8px]">
        <input type="hidden" name="number" value={order.number} />
        <input type="hidden" name="back" value={back} />
        <div className="min-w-[200px] grow">
          <input
            name="note"
            defaultValue={order.adminNote ?? ""}
            maxLength={2000}
            placeholder="Vaša beleška (kupac je ne vidi), npr. broj pošiljke"
            aria-label={`Beleška uz porudžbinu ${order.number}`}
            className={inputClass}
          />
        </div>
        <button type="submit" className={quietButtonClass}>
          Sačuvaj belešku
        </button>
      </form>

      <div className="mt-[12px] flex flex-wrap gap-[8px]">
        {!detail && (
          <Link href={`${ADMIN_PATH}/porudzbine/${order.number}`} className={quietButtonClass}>
            Detalji
          </Link>
        )}
        {nextSteps[order.status].map((step) => (
          <form key={step.status} action={setOrderStatusAction}>
            <input type="hidden" name="number" value={order.number} />
            <input type="hidden" name="status" value={step.status} />
            <input type="hidden" name="back" value={back} />
            <button type="submit" className={quietButtonClass}>
              {step.label}
            </button>
          </form>
        ))}
      </div>
    </article>
  );
}
