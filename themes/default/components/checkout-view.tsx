"use client";

import { usePath } from "@/lib/i18n/client";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { type CSSProperties, type FormEvent, useEffect, useState, useTransition } from "react";
import { countLabel, formatPrice } from "@/lib/storefront/products";
import {
  placeOrderAction,
  quoteAction,
  saveCartAction,
  type CartQuote,
  type CheckoutErrors,
  type CheckoutField,
  type PlacedOrder,
} from "@/app/(shop)/actions";
import { availableMethods, methodPrice } from "@/lib/shipping";
import { track } from "./analytics";
import { cartKey, shippingFor, useCart, type CartItem } from "./cart";
import { ERROR_STYLE, Field } from "./field";
import { CheckIcon, Photo } from "./ui";

const wrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "clamp(28px, 4.5vw, 72px)",
  paddingTop: "clamp(32px, 4.5vw, 64px)",
  paddingBottom: "clamp(64px, 8vw, 120px)",
  alignItems: "flex-start",
};
const fieldset: CSSProperties = { border: 0, margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "20px" };
const legend: CSSProperties = { padding: 0, marginBottom: "18px" };
const row: CSSProperties = { display: "flex", justifyContent: "space-between" };
const strong: CSSProperties = { fontWeight: 600 };
const hint: CSSProperties = { fontSize: "15px" };

// Opisi ispod načina plaćanja, iz dizajna. Koji su načini uključeni određuje CRM (Podešavanja → Plaćanje).
const PAYMENT_HINTS = {
  cod: "Plaćate pri isporuci",
  bank: "Podatke za uplatu dobijate na email",
  card: "Posle potvrde vas vodimo na stranicu za plaćanje",
};

type User = { email: string; firstName: string; lastName: string; phone?: string; street?: string; city?: string; postalCode?: string };
type Fields = Record<CheckoutField, string>;
type Totals = { subtotal: number; discount: number; discountText: string; deliveryMethod: string; delivery: number; total: number };

export function CheckoutView({ user }: { user: User | null }) {
  const to = usePath();
  const t = useT();
  const { config, items, count, subtotal, weight, clear } = useCart();
  const texts = config.texts.checkout;
  const [fields, setFields] = useState<Fields>({
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    address: user?.street ?? "",
    city: user?.city ?? "",
    zip: user?.postalCode ?? "",
    note: "",
  });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [message, setMessage] = useState("");
  const [methodId, setMethodId] = useState("");
  const [payment, setPayment] = useState<string>(config.payments[0].id);
  const [promoInput, setPromoInput] = useState("");
  // Kod koji je kupac primenio, i obračun sa servera (cene, popust, dostava) za trenutnu korpu.
  const [promoCode, setPromoCode] = useState("");
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [placed, setPlaced] = useState<{ order: PlacedOrder; lines: CartItem[] } | null>(null);
  const [pending, startTransition] = useTransition();

  // Korpa se pamti uz email dok kupac popunjava formu, da dobije podsetnik ako ne poruči.
  // Šalje se sa zakašnjenjem i samo kada su podsetnici uključeni u panelu.
  const cartKeys = items.map((item) => `${cartKey(item)}×${item.qty}`).join("|");
  useEffect(() => {
    if (!config.cartReminder || placed || count === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) return;
    const timer = setTimeout(() => {
      void saveCartAction({
        email: fields.email,
        firstName: fields.firstName,
        items: items.map(({ slug, variantId, qty }) => ({ slug, variantId, qty })),
      });
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.email, fields.firstName, cartKeys, config.cartReminder, placed]);

  // Obračun sa servera pri svakoj izmeni korpe, koda, načina dostave ili poštanskog broja.
  const zip = fields.zip.trim();
  const deliveryId = availableMethods(config.shipping, zip).find((candidate) => candidate.id === methodId)?.id ?? "";
  useEffect(() => {
    if (placed || count === 0) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const next = await quoteAction({
        items: items.map(({ slug, variantId, qty }) => ({ slug, variantId, qty })),
        promoCode,
        delivery: deliveryId,
        zip,
      });
      if (!stale && next) setQuote(next);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKeys, promoCode, deliveryId, zip, placed]);

  if (placed) return <Confirmation order={placed.order} lines={placed.lines} />;

  const set = (name: CheckoutField) => (event: { target: { value: string } }) => {
    setFields({ ...fields, [name]: event.target.value });
    if (errors[name]) setErrors({ ...errors, [name]: undefined });
  };

  // Načini dostave koji važe za upisani poštanski broj; izabran je onaj koji je kupac označio, inače prvi.
  const methods = availableMethods(config.shipping, fields.zip);
  const method = methods.find((candidate) => candidate.id === methodId) ?? methods[0];
  // Obračun radi server (kod, automatski popust, dostava). Dok odgovor ne stigne, prikazuje se
  // obračun bez popusta, po istim pravilima za dostavu.
  const discount = count === 0 ? 0 : (quote?.discount ?? 0);
  const paid = subtotal - discount;
  const ship = shippingFor(method, paid, weight);
  const delivery = count === 0 ? 0 : (quote?.delivery ?? ship.price);
  const total = paid + delivery;
  const promoError = promoCode ? (quote?.codeError ?? "") : "";

  function applyPromo() {
    setPromoCode(promoInput.trim());
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (count === 0) return setMessage(t("Korpa je prazna. Dodajte proizvod pa potvrdite porudžbinu."));
    setMessage("");
    startTransition(async () => {
      const result = await placeOrderAction({
        customer: fields,
        items: items.map(({ slug, variantId, qty }) => ({ slug, variantId, qty })),
        promoCode,
        payment,
        delivery: method?.id ?? "",
      });
      if (!result.ok) {
        setErrors(result.errors);
        setMessage(t(result.message ?? ""));
        const first = Object.keys(result.errors)[0];
        if (first) document.getElementById(`c-${first}`)?.focus();
        return;
      }
      clear();
      // Kartica: plaćanje je na stranici procesora; kupac se posle vraća na sajt.
      if (result.order.paymentUrl) {
        window.location.assign(result.order.paymentUrl);
        return;
      }
      track("purchase", { value: result.order.total, currency: "RSD", id: result.order.number });
      setPlaced({ order: result.order, lines: items });
      window.scrollTo(0, 0);
    });
  }

  return (
    <div className="wrap" style={wrapStyle}>
      {/* FORMA */}
      <form onSubmit={submit} noValidate style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: "44px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <h1 className="display h-l">
            <span className="ln"><span>{texts.heading}</span></span>
          </h1>
          <ol className="a1" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <li className="chip on" style={{ display: "flex", alignItems: "center", cursor: "default", color: "#FFFFFF" }}>{t("1. Podaci")}</li>
            <li className="chip" style={{ display: "flex", alignItems: "center", cursor: "default", color: "var(--soft)" }}>{t("2. Dostava")}</li>
            <li className="chip" style={{ display: "flex", alignItems: "center", cursor: "default", color: "var(--soft)" }}>{t("3. Plaćanje")}</li>
          </ol>
        </div>

        <fieldset style={fieldset}>
          <legend className="display h-s" style={legend}>{t("Kontakt")}</legend>
          <div className="fgrid">
            <Field id="c-email" label={t("Email adresa")} type="email" autoComplete="email" placeholder={t("ime@primer.rs")} value={fields.email} onChange={set("email")} error={errors.email} />
            <Field id="c-phone" label={t("Telefon")} type="tel" autoComplete="tel" placeholder={t("+381 6x xxx xxxx")} value={fields.phone} onChange={set("phone")} error={errors.phone} />
          </div>
          {config.cartReminder && (
            <p className="muted" style={{ fontSize: "14px" }}>
              {t("Ako ne završite porudžbinu, na ovu adresu šaljemo jedan podsetnik sa vašom korpom.")}
            </p>
          )}
          {user ? (
            <p className="muted" style={hint}>
              {t("Prijavljeni ste kao {ime}. Porudžbina će biti u vašem", { ime: `${user.firstName} ${user.lastName}` })} <Link href={to("/nalog")}>{t("nalogu")}</Link>.
            </p>
          ) : (
            <p className="muted" style={hint}>
              {t("Već imate nalog?")} <Link href={to("/nalog")}>{t("Prijavite se")}</Link> {t("za bržu kupovinu.")}
            </p>
          )}
        </fieldset>

        <fieldset style={fieldset}>
          <legend className="display h-s" style={legend}>{t("Adresa za dostavu")}</legend>
          <div className="fgrid">
            <Field id="c-firstName" label={t("Ime")} type="text" autoComplete="given-name" value={fields.firstName} onChange={set("firstName")} error={errors.firstName} />
            <Field id="c-lastName" label={t("Prezime")} type="text" autoComplete="family-name" value={fields.lastName} onChange={set("lastName")} error={errors.lastName} />
          </div>
          <Field id="c-address" label={t("Ulica i broj")} type="text" autoComplete="street-address" value={fields.address} onChange={set("address")} error={errors.address} />
          <div className="fgrid">
            <Field id="c-city" label={t("Grad")} type="text" autoComplete="address-level2" value={fields.city} onChange={set("city")} error={errors.city} />
            <Field id="c-zip" label={t("Poštanski broj")} type="text" inputMode="numeric" autoComplete="postal-code" value={fields.zip} onChange={set("zip")} error={errors.zip} />
          </div>
          <Field id="c-note" label={t("Sprat, lift i napomena za dostavu (opciono)")} type="text" maxLength={250} value={fields.note} onChange={set("note")} error={errors.note} />
        </fieldset>

        <fieldset style={{ ...fieldset, gap: "10px" }}>
          <legend className="display h-s" style={legend}>{t("Način dostave")}</legend>
          {methods.map((option) => {
            const price = methodPrice(option, paid, weight);
            return (
              <label className="opt" key={option.id}>
                <input type="radio" name="ship" checked={option.id === method?.id} onChange={() => setMethodId(option.id)} />
                <span style={{ flex: 1 }}>
                  <strong style={strong}>{option.name}</strong>
                  {option.hint && (
                    <>
                      <br />
                      <span className="muted" style={hint}>{option.hint}</span>
                    </>
                  )}
                </span>
                <span style={strong}>{price === 0 ? t("Besplatno") : formatPrice(price)}</span>
              </label>
            );
          })}
          {methods.length === 0 && (
            <p role="alert" style={ERROR_STYLE}>{t("Na ovaj poštanski broj trenutno ne isporučujemo. Javite nam se da nađemo rešenje.")}</p>
          )}
        </fieldset>

        <fieldset style={{ ...fieldset, gap: "10px" }}>
          <legend className="display h-s" style={legend}>{t("Način plaćanja")}</legend>
          {config.payments.map((method) => (
            <label className="opt" key={method.id}>
              <input type="radio" name="pay" checked={payment === method.id} onChange={() => setPayment(method.id)} />
              <span style={{ flex: 1 }}>
                <strong style={strong}>{t(method.label)}</strong>
                <br />
                <span className="muted" style={hint}>{t(PAYMENT_HINTS[method.id])}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {message && (
            <p role="alert" style={{ ...ERROR_STYLE, textAlign: "center" }}>
              {message}
            </p>
          )}
          <button className="btn gold full" type="submit" disabled={pending} style={{ minHeight: "66px", fontSize: "17px" }}>
            {t("Potvrdi porudžbinu, {iznos}", { iznos: formatPrice(total) })}
          </button>
          <p className="muted" style={{ fontSize: "14px", textAlign: "center" }}>
            {t("Potvrdom prihvatate")} <Link href={to(texts.termsHref || "/")}>{t("uslove kupovine")}</Link>. {texts.termsNote}
          </p>
        </div>
      </form>

      {/* PREGLED */}
      <aside className="sticky panel" aria-label={t("Pregled porudžbine")} style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="display h-s">{t("Vaša porudžbina")}</h2>
          <span className="muted" style={{ fontSize: "15px" }}>{t(countLabel(count))}</span>
        </div>
        {count === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", alignItems: "flex-start" }}>
            <p className="muted">{t("Korpa je prazna.")}</p>
            <Link className="btn ghost" href={to("/kolekcija")}>{t("Pogledajte kolekciju")}</Link>
          </div>
        ) : (
          <Lines items={items} />
        )}

        <div>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <div className="f" style={{ flex: 1 }}>
              <label htmlFor="c-promo">{t("Promo kod")}</label>
              <input
                id="c-promo"
                type="text"
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyPromo();
                  }
                }}
                style={{ background: "var(--paper)" }}
              />
            </div>
            <button className="btn ghost" type="button" onClick={applyPromo} disabled={pending} style={{ minHeight: "56px", padding: "0 22px" }}>
              {t("Primeni")}
            </button>
          </div>
          {promoError && <p role="alert" style={{ ...ERROR_STYLE, marginTop: "8px" }}>{t(promoError)}</p>}
          {quote?.discountText && (
            <p role="status" className="muted" style={{ fontSize: "14px", marginTop: "8px" }}>
              {t("Primenjeno: {popust}.", { popust: t(quote.discountText) })}
            </p>
          )}
        </div>

        {ship.freeFrom !== null && (
          <div style={{ background: "var(--paper)", borderRadius: "18px", padding: "16px 18px" }}>
            {delivery === 0 ? (
              <div style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckIcon />
                <span>
                  {t("Dostava je")} <strong>{t("besplatna")}</strong>
                </span>
              </div>
            ) : (
              <div style={{ fontSize: "15px" }}>
                {t("Još")} <strong>{formatPrice(ship.remaining)}</strong> {t("do besplatne dostave")}
              </div>
            )}
            <div className="ship-track">
              <div className="ship-fill" style={{ width: ship.pct }}></div>
            </div>
          </div>
        )}

        <TotalRows subtotal={subtotal} discount={discount} discountText={quote?.discountText ?? ""} deliveryMethod={method?.name ?? t("Dostava")} delivery={delivery} total={total} />
      </aside>
    </div>
  );
}

function Lines({ items }: { items: CartItem[] }) {
  const t = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {items.map((it) => (
        <div style={{ display: "flex", gap: "14px", alignItems: "center", background: "var(--paper)", borderRadius: "20px", padding: "10px 16px 10px 10px" }} key={cartKey(it)}>
          <div className="ph" style={{ width: "72px", height: "84px", flexShrink: 0, borderRadius: "14px" }}>
            {it.image && <Photo src={it.image} alt="" sizes="72px" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="card-name" style={{ fontSize: "17px" }}>{it.name}</div>
            <div className="muted" style={{ fontSize: "14px" }}>
              {it.variant} · {t("{n} kom", { n: it.qty })}
            </div>
          </div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, whiteSpace: "nowrap" }}>{formatPrice(it.price * it.qty)}</div>
        </div>
      ))}
    </div>
  );
}

function TotalRows({ subtotal, discount, discountText, deliveryMethod, delivery, total }: Totals) {
  const t = useT();
  const texts = useCart().config.texts.checkout;
  const { priceNote } = texts;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "16px" }}>
      <div style={row}>
        <span className="muted">{t("Međuzbir")}</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      {(discount > 0 || discountText) && (
        <div style={row}>
          <span className="muted">{discountText ? t(discountText) : t("Popust")}</span>
          <span>{discount > 0 ? `−${formatPrice(discount)}` : ""}</span>
        </div>
      )}
      <div style={row}>
        <span className="muted">{deliveryMethod}</span>
        <span>{delivery === 0 ? t("Besplatno") : formatPrice(delivery)}</span>
      </div>
      <hr className="rule" style={{ margin: "6px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="lab">{t("Ukupno")}</span>
        <span className="display" style={{ fontSize: "32px" }}>{formatPrice(total)}</span>
      </div>
      {priceNote && <div className="muted" style={{ fontSize: "14px", textAlign: "right" }}>{priceNote}</div>}
    </div>
  );
}

/** Potvrda posle porudžbine, sa obračunom iz CRM-a. U dizajnu ne postoji, pa je složena od postojećih elemenata. */
function Confirmation({ order, lines }: { order: PlacedOrder; lines: CartItem[] }) {
  const to = usePath();
  const t = useT();
  return (
    <div className="wrap" style={wrapStyle}>
      <div style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: "22px", alignItems: "flex-start" }}>
        <span className="icon-c a1" style={{ background: "var(--gold)" }}>
          <CheckIcon />
        </span>
        <h1 className="display h-l">
          <span className="ln"><span>{t("Hvala na porudžbini")}</span></span>
        </h1>
        <p className="lead a1">
          {t("Porudžbina broj")} <strong style={{ color: "var(--ink)" }}>{order.number}</strong> {t("je primljena, {ime}.", { ime: order.firstName })}{" "}
          {order.deliveryNote}{" "}
          {order.paymentMethod === "cod" ? t("Plaćate pri isporuci.") : order.paymentMethod === "bank" ? t("Plaćate uplatom na račun.") : ""}
        </p>
        {order.paymentInstructions && (
          <div className="panel a2" style={{ padding: "18px 22px", borderRadius: "20px", fontSize: "15.5px", whiteSpace: "pre-wrap" }}>
            <div className="lab" style={{ marginBottom: "6px" }}>{t("Podaci za uplatu")}</div>
            {order.paymentInstructions}
            {/* Iznos i poziv na broj su iz porudžbine, da kupac ne mora da ih traži. */}
            <div style={{ marginTop: "10px" }}>
              {t("Iznos:")} <strong>{formatPrice(order.total)}</strong> · {t("Poziv na broj:")} <strong>{order.number}</strong>
            </div>
          </div>
        )}
        <div className="a2" style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <Link className="btn" href={to("/kolekcija")}>{t("Nastavite kupovinu")}</Link>
          <Link className="btn ghost" href={to("/nalog")}>{t("Moj nalog")}</Link>
        </div>
      </div>

      <aside className="sticky panel" aria-label={t("Pregled porudžbine")} style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="display h-s">{t("Vaša porudžbina")}</h2>
          <span className="muted" style={{ fontSize: "15px" }}>{t(countLabel(lines.reduce((sum, item) => sum + item.qty, 0)))}</span>
        </div>
        <Lines items={lines} />
        <TotalRows {...order} />
      </aside>
    </div>
  );
}
