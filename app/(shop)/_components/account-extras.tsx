"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import type { ShopAddress } from "@/lib/storefront/auth";
import { formatPrice } from "@/lib/storefront/products";
import {
  deleteAccountAction,
  requestResetAction,
  resetPasswordAction,
  returnRequestAction,
  saveAddressAction,
  trackOrderAction,
  unsubscribeNewsletterAction,
  type OrderView,
} from "../actions";
import { ERROR_STYLE, Field } from "./field";

const stack = { display: "flex", flexDirection: "column", gap: "18px", maxWidth: "520px", width: "100%" } as const;

/** Zahtev za novu lozinku: link stiže emailom. */
export function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ sent: boolean; error: string }>({ sent: false, error: "" });
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await requestResetAction(email);
      setState(result.ok ? { sent: true, error: "" } : { sent: false, error: result.error });
    });
  }

  if (state.sent) {
    return (
      <p className="lead" role="status">
        Ako nalog sa tom adresom postoji, poslali smo link za novu lozinku. Link važi jedan sat. Proverite i
        neželjenu poštu.
      </p>
    );
  }
  return (
    <form onSubmit={submit} noValidate style={stack}>
      <Field id="reset-email" label="Email adresa" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      {state.error && <p role="alert" style={ERROR_STYLE}>{state.error}</p>}
      <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>Pošalji link</button>
    </form>
  );
}

/** Nova lozinka po linku iz emaila. */
export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<{ done: boolean; error: string }>({ done: false, error: "" });
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await resetPasswordAction(token, password);
      setState(result.ok ? { done: true, error: "" } : { done: false, error: result.error });
    });
  }

  if (state.done) {
    return (
      <div style={stack}>
        <p className="lead" role="status">Lozinka je promenjena. Prijavite se novom lozinkom.</p>
        <Link className="btn" href="/nalog" style={{ alignSelf: "flex-start" }}>Prijava</Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate style={stack}>
      <Field id="reset-pass" label="Nova lozinka" type="password" autoComplete="new-password" placeholder="Najmanje 8 karaktera" value={password} onChange={(event) => setPassword(event.target.value)} />
      {state.error && <p role="alert" style={ERROR_STYLE}>{state.error}</p>}
      <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>Sačuvaj lozinku</button>
    </form>
  );
}

/** Adresa za dostavu uz nalog. */
export function AddressForm({ address }: { address: ShopAddress }) {
  const [fields, setFields] = useState(address);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const set = (name: keyof ShopAddress) => (event: { target: { value: string } }) => {
    setFields({ ...fields, [name]: event.target.value });
    setMessage("");
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveAddressAction(fields);
      setMessage(result.ok ? "Adresa je sačuvana." : result.error);
    });
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Field id="a-street" label="Ulica i broj" type="text" autoComplete="street-address" value={fields.street} onChange={set("street")} />
      <div className="fgrid">
        <Field id="a-zip" label="Poštanski broj" type="text" autoComplete="postal-code" value={fields.postalCode} onChange={set("postalCode")} />
        <Field id="a-city" label="Mesto" type="text" autoComplete="address-level2" value={fields.city} onChange={set("city")} />
      </div>
      <Field id="a-phone" label="Telefon" type="tel" autoComplete="tel" value={fields.phone} onChange={set("phone")} />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px" }}>
        <button className="btn ghost" type="submit" disabled={pending}>Sačuvaj adresu</button>
        {message && <span role="status" style={{ fontSize: "15px", fontWeight: 600 }}>{message}</span>}
      </div>
    </form>
  );
}

/** Brisanje naloga, uz potvrdu. */
export function DeleteAccount() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="txt-btn"
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Obrisati nalog? Porudžbine ostaju u evidenciji prodavnice; za njihovo brisanje nam pišite.")) return;
        startTransition(async () => {
          await deleteAccountAction();
          router.refresh();
        });
      }}
    >
      Obriši nalog
    </button>
  );
}

/** Odjava od novosti: na klik, da je ne pokrene program za poštu koji sam otvara linkove. */
export function NewsletterUnsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  if (state === "done") return <p className="lead">Odjavljeni ste. Novosti vam više ne šaljemo.</p>;
  return (
    <>
      <p className="lead">Ne želite više da primate novosti na ovu adresu?</p>
      <button className="btn" onClick={async () => setState((await unsubscribeNewsletterAction(token)) ? "done" : "failed")}>
        Odjavi me
      </button>
      {state === "failed" && <p role="alert">Odjava nije uspela. Pokušajte ponovo ili nam pišite.</p>}
    </>
  );
}

type OrderLookupProps = {
  /** Broj porudžbine iz adrese (link iz naloga). */
  number: string;
  /** Kupac je prijavljen: svoje porudžbine vidi bez upisivanja email adrese. */
  loggedIn: boolean;
};

/** Praćenje porudžbine po broju i email adresi, i zahtev za povrat. */
export function OrderLookup({ number: initial, loggedIn }: OrderLookupProps) {
  const [number, setNumber] = useState(initial);
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function find(event?: FormEvent) {
    event?.preventDefault();
    startTransition(async () => {
      const result = await trackOrderAction({ number, email });
      setOrder(result.ok ? result.order : null);
      setError(result.ok ? "" : result.error);
    });
  }

  // Link iz naloga otvara porudžbinu odmah.
  useEffect(() => {
    if (initial && loggedIn) find();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(24px, 4vw, 64px)", alignItems: "flex-start" }}>
      <form onSubmit={find} noValidate style={{ ...stack, flex: "1 1 320px" }}>
        <Field id="t-number" label="Broj porudžbine" type="text" inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value)} />
        <Field id="t-email" label={loggedIn ? "Email adresa (nije potrebna za vaše porudžbine)" : "Email adresa sa kojom ste poručili"} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        {error && <p role="alert" style={ERROR_STYLE}>{error}</p>}
        <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>Prikaži porudžbinu</button>
      </form>

      {order && (
        <div className="panel" style={{ flex: "2 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }} aria-live="polite">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "8px 24px" }}>
            <h2 className="display h-m">Porudžbina {order.number}</h2>
            <span className="tag" style={{ position: "static" }}>{order.status}</span>
          </div>
          <div className="muted" style={{ fontSize: "15px" }}>
            {order.date}
            {order.deliveryMethod && ` · ${order.deliveryMethod}`}
          </div>
          {order.tracking && (
            <div style={{ fontSize: "15.5px" }}>
              Broj pošiljke: <strong>{order.tracking.number}</strong>
              {order.tracking.url && (
                <>
                  {" · "}
                  <a className="ul" href={order.tracking.url} target="_blank" rel="noreferrer">Pratite pošiljku</a>
                </>
              )}
            </div>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "6px", fontSize: "15.5px" }}>
            {order.items.map((item) => (
              <li key={item.position}>{item.qty} × {item.name}</li>
            ))}
          </ul>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
            <span className="lab">Ukupno</span>
            <span className="display h-s">{formatPrice(order.total)}</span>
          </div>
          {order.refunded > 0 && <div className="muted" style={{ fontSize: "15px" }}>Vraćeno: {formatPrice(order.refunded)}</div>}

          {order.returns.map((request, index) => (
            <div key={index} style={{ background: "var(--paper)", borderRadius: "18px", padding: "14px 18px", fontSize: "15px" }}>
              <strong>Zahtev za povrat ({request.status})</strong> · {request.date}
              <div className="muted">{request.items}</div>
              {request.answer && <div style={{ marginTop: "6px" }}>{request.answer}</div>}
            </div>
          ))}
          {order.canReturn && <ReturnForm order={order} email={email} onDone={setOrder} />}
        </div>
      )}
    </div>
  );
}

function ReturnForm({ order, email, onDone }: { order: OrderView; email: string; onDone: (order: OrderView) => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await returnRequestAction({
        number: order.number,
        email,
        items: Object.entries(qty).map(([position, count]) => ({ position: Number(position), qty: count })),
        reason,
      });
      if (result.ok) onDone(result.order);
      else setError(result.error);
    });
  }

  if (!open) {
    return (
      <button className="btn ghost" type="button" onClick={() => setOpen(true)} style={{ alignSelf: "flex-start" }}>
        Zatražite povrat
      </button>
    );
  }
  return (
    <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
      <div className="lab">Šta vraćate</div>
      {order.items.filter((item) => item.returnable > 0).map((item) => (
        <label key={item.position} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "15.5px" }}>
          <select
            aria-label={`Broj komada: ${item.name}`}
            value={qty[item.position] ?? 0}
            onChange={(event) => setQty({ ...qty, [item.position]: Number(event.target.value) })}
            style={{ width: "76px", minHeight: "44px", borderRadius: "12px", padding: "0 10px" }}
          >
            {Array.from({ length: item.returnable + 1 }, (_, count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
          {item.name}
        </label>
      ))}
      <div className="f">
        <label htmlFor="r-reason">Zašto vraćate</label>
        <textarea id="r-reason" value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)}></textarea>
      </div>
      {error && <p role="alert" style={ERROR_STYLE}>{error}</p>}
      <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>Pošalji zahtev</button>
    </form>
  );
}
