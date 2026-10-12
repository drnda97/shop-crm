"use client";

import Link from "next/link";
import { type CSSProperties, type FormEvent, useEffect, useState, useTransition } from "react";
import { countLabel, formatPrice } from "@/lib/storefront/products";
import {
  checkPromoAction,
  placeOrderAction,
  saveCartAction,
  type CheckoutErrors,
  type CheckoutField,
  type PlacedOrder,
} from "../actions";
import { availableMethods, methodPrice } from "@/lib/shipping";
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

type User = { email: string; firstName: string; lastName: string };
type Fields = Record<CheckoutField, string>;
type Totals = { subtotal: number; discount: number; promoCode: string; deliveryMethod: string; delivery: number; total: number };

export function CheckoutView({ user }: { user: User | null }) {
  const { config, items, count, subtotal, weight, clear } = useCart();
  const texts = config.texts.checkout;
  const [fields, setFields] = useState<Fields>({
    email: user?.email ?? "",
    phone: "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    address: "",
    city: "",
    zip: "",
    note: "",
  });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [message, setMessage] = useState("");
  const [methodId, setMethodId] = useState("");
  const [payment, setPayment] = useState<string>(config.payments[0].id);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(null);
  const [promoError, setPromoError] = useState("");
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

  if (placed) return <Confirmation order={placed.order} lines={placed.lines} />;

  const set = (name: CheckoutField) => (event: { target: { value: string } }) => {
    setFields({ ...fields, [name]: event.target.value });
    if (errors[name]) setErrors({ ...errors, [name]: undefined });
  };

  // Pregled pre potvrde, po istim pravilima kao u CRM-u: popust se oduzima od zbira
  // proizvoda, a prag za besplatnu dostavu gleda iznos posle popusta. Konačan obračun radi CRM.
  const discount = promo ? Math.round((subtotal * promo.percent) / 100) : 0;
  const paid = subtotal - discount;
  // Načini dostave koji važe za upisani poštanski broj; izabran je onaj koji je kupac označio, inače prvi.
  const methods = availableMethods(config.shipping, fields.zip);
  const method = methods.find((candidate) => candidate.id === methodId) ?? methods[0];
  const ship = shippingFor(method, paid, weight);
  const delivery = count === 0 ? 0 : ship.price;
  const total = paid + delivery;

  function applyPromo() {
    if (!promoInput.trim()) {
      setPromo(null);
      return setPromoError("Upišite promo kod.");
    }
    startTransition(async () => {
      const result = await checkPromoAction(promoInput);
      setPromo(result.ok ? { code: result.code, percent: result.percent } : null);
      setPromoError(result.ok ? "" : result.message);
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (count === 0) return setMessage("Korpa je prazna. Dodajte proizvod pa potvrdite porudžbinu.");
    setMessage("");
    startTransition(async () => {
      const result = await placeOrderAction({
        customer: fields,
        items: items.map(({ slug, variantId, qty }) => ({ slug, variantId, qty })),
        promoCode: promo?.code ?? "",
        payment,
        delivery: method?.id ?? "",
      });
      if (!result.ok) {
        setErrors(result.errors);
        setMessage(result.message ?? "");
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
            <li className="chip on" style={{ display: "flex", alignItems: "center", cursor: "default", color: "#FFFFFF" }}>1. Podaci</li>
            <li className="chip" style={{ display: "flex", alignItems: "center", cursor: "default", color: "var(--soft)" }}>2. Dostava</li>
            <li className="chip" style={{ display: "flex", alignItems: "center", cursor: "default", color: "var(--soft)" }}>3. Plaćanje</li>
          </ol>
        </div>

        <fieldset style={fieldset}>
          <legend className="display h-s" style={legend}>Kontakt</legend>
          <div className="fgrid">
            <Field id="c-email" label="Email adresa" type="email" autoComplete="email" placeholder="ime@primer.rs" value={fields.email} onChange={set("email")} error={errors.email} />
            <Field id="c-phone" label="Telefon" type="tel" autoComplete="tel" placeholder="+381 6x xxx xxxx" value={fields.phone} onChange={set("phone")} error={errors.phone} />
          </div>
          {config.cartReminder && (
            <p className="muted" style={{ fontSize: "14px" }}>
              Ako ne završite porudžbinu, na ovu adresu šaljemo jedan podsetnik sa vašom korpom.
            </p>
          )}
          {user ? (
            <p className="muted" style={hint}>
              Prijavljeni ste kao {user.firstName} {user.lastName}. Porudžbina će biti u vašem <Link href="/nalog">nalogu</Link>.
            </p>
          ) : (
            <p className="muted" style={hint}>
              Već imate nalog? <Link href="/nalog">Prijavite se</Link> za bržu kupovinu.
            </p>
          )}
        </fieldset>

        <fieldset style={fieldset}>
          <legend className="display h-s" style={legend}>Adresa za dostavu</legend>
          <div className="fgrid">
            <Field id="c-firstName" label="Ime" type="text" autoComplete="given-name" value={fields.firstName} onChange={set("firstName")} error={errors.firstName} />
            <Field id="c-lastName" label="Prezime" type="text" autoComplete="family-name" value={fields.lastName} onChange={set("lastName")} error={errors.lastName} />
          </div>
          <Field id="c-address" label="Ulica i broj" type="text" autoComplete="street-address" value={fields.address} onChange={set("address")} error={errors.address} />
          <div className="fgrid">
            <Field id="c-city" label="Grad" type="text" autoComplete="address-level2" value={fields.city} onChange={set("city")} error={errors.city} />
            <Field id="c-zip" label="Poštanski broj" type="text" inputMode="numeric" autoComplete="postal-code" value={fields.zip} onChange={set("zip")} error={errors.zip} />
          </div>
          <Field id="c-note" label="Sprat, lift i napomena za dostavu (opciono)" type="text" maxLength={250} value={fields.note} onChange={set("note")} error={errors.note} />
        </fieldset>

        <fieldset style={{ ...fieldset, gap: "10px" }}>
          <legend className="display h-s" style={legend}>Način dostave</legend>
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
                <span style={strong}>{price === 0 ? "Besplatno" : formatPrice(price)}</span>
              </label>
            );
          })}
          {methods.length === 0 && (
            <p role="alert" style={ERROR_STYLE}>Na ovaj poštanski broj trenutno ne isporučujemo. Javite nam se da nađemo rešenje.</p>
          )}
        </fieldset>

        <fieldset style={{ ...fieldset, gap: "10px" }}>
          <legend className="display h-s" style={legend}>Način plaćanja</legend>
          {config.payments.map((method) => (
            <label className="opt" key={method.id}>
              <input type="radio" name="pay" checked={payment === method.id} onChange={() => setPayment(method.id)} />
              <span style={{ flex: 1 }}>
                <strong style={strong}>{method.label}</strong>
                <br />
                <span className="muted" style={hint}>{PAYMENT_HINTS[method.id]}</span>
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
            Potvrdi porudžbinu, {formatPrice(total)}
          </button>
          <p className="muted" style={{ fontSize: "14px", textAlign: "center" }}>
            Potvrdom prihvatate <Link href={texts.termsHref || "/"}>uslove kupovine</Link>. {texts.termsNote}
          </p>
        </div>
      </form>

      {/* PREGLED */}
      <aside className="sticky panel" aria-label="Pregled porudžbine" style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="display h-s">Vaša porudžbina</h2>
          <span className="muted" style={{ fontSize: "15px" }}>{countLabel(count)}</span>
        </div>
        {count === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", alignItems: "flex-start" }}>
            <p className="muted">Korpa je prazna.</p>
            <Link className="btn ghost" href="/kolekcija">Pogledajte kolekciju</Link>
          </div>
        ) : (
          <Lines items={items} />
        )}

        <div>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <div className="f" style={{ flex: 1 }}>
              <label htmlFor="c-promo">Promo kod</label>
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
              Primeni
            </button>
          </div>
          {promoError && <p role="alert" style={{ ...ERROR_STYLE, marginTop: "8px" }}>{promoError}</p>}
          {promo && (
            <p role="status" className="muted" style={{ fontSize: "14px", marginTop: "8px" }}>
              Kod {promo.code} je primenjen: {promo.percent}% popusta.
            </p>
          )}
        </div>

        {ship.freeFrom !== null && (
          <div style={{ background: "var(--paper)", borderRadius: "18px", padding: "16px 18px" }}>
            {ship.isFree ? (
              <div style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckIcon />
                <span>
                  Dostava je <strong>besplatna</strong>
                </span>
              </div>
            ) : (
              <div style={{ fontSize: "15px" }}>
                Još <strong>{formatPrice(ship.remaining)}</strong> do besplatne dostave
              </div>
            )}
            <div className="ship-track">
              <div className="ship-fill" style={{ width: ship.pct }}></div>
            </div>
          </div>
        )}

        <TotalRows subtotal={subtotal} discount={discount} promoCode={promo?.code ?? ""} deliveryMethod={method?.name ?? "Dostava"} delivery={delivery} total={total} />
      </aside>
    </div>
  );
}

function Lines({ items }: { items: CartItem[] }) {
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
              {it.variant} · {it.qty} kom
            </div>
          </div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, whiteSpace: "nowrap" }}>{formatPrice(it.price * it.qty)}</div>
        </div>
      ))}
    </div>
  );
}

function TotalRows({ subtotal, discount, promoCode, deliveryMethod, delivery, total }: Totals) {
  const texts = useCart().config.texts.checkout;
  const { priceNote } = texts;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "16px" }}>
      <div style={row}>
        <span className="muted">Međuzbir</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div style={row}>
          <span className="muted">Popust ({promoCode})</span>
          <span>−{formatPrice(discount)}</span>
        </div>
      )}
      <div style={row}>
        <span className="muted">{deliveryMethod}</span>
        <span>{delivery === 0 ? "Besplatno" : formatPrice(delivery)}</span>
      </div>
      <hr className="rule" style={{ margin: "6px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="lab">Ukupno</span>
        <span className="display" style={{ fontSize: "32px" }}>{formatPrice(total)}</span>
      </div>
      {priceNote && <div className="muted" style={{ fontSize: "14px", textAlign: "right" }}>{priceNote}</div>}
    </div>
  );
}

/** Potvrda posle porudžbine, sa obračunom iz CRM-a. U dizajnu ne postoji, pa je složena od postojećih elemenata. */
function Confirmation({ order, lines }: { order: PlacedOrder; lines: CartItem[] }) {
  return (
    <div className="wrap" style={wrapStyle}>
      <div style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: "22px", alignItems: "flex-start" }}>
        <span className="icon-c a1" style={{ background: "var(--gold)" }}>
          <CheckIcon />
        </span>
        <h1 className="display h-l">
          <span className="ln"><span>Hvala na porudžbini</span></span>
        </h1>
        <p className="lead a1">
          Porudžbina broj <strong style={{ color: "var(--ink)" }}>{order.number}</strong> je primljena, {order.firstName}.{" "}
          {order.deliveryNote}{" "}
          {order.paymentMethod === "cod" ? "Plaćate pri isporuci." : order.paymentMethod === "bank" ? "Plaćate uplatom na račun." : ""}
        </p>
        {order.paymentInstructions && (
          <div className="panel a2" style={{ padding: "18px 22px", borderRadius: "20px", fontSize: "15.5px", whiteSpace: "pre-wrap" }}>
            <div className="lab" style={{ marginBottom: "6px" }}>Podaci za uplatu</div>
            {order.paymentInstructions}
          </div>
        )}
        <div className="a2" style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <Link className="btn" href="/kolekcija">Nastavite kupovinu</Link>
          <Link className="btn ghost" href="/nalog">Moj nalog</Link>
        </div>
      </div>

      <aside className="sticky panel" aria-label="Pregled porudžbine" style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="display h-s">Vaša porudžbina</h2>
          <span className="muted" style={{ fontSize: "15px" }}>{countLabel(lines.reduce((sum, item) => sum + item.qty, 0))}</span>
        </div>
        <Lines items={lines} />
        <TotalRows {...order} />
      </aside>
    </div>
  );
}
