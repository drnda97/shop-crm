"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { countLabel, formatPrice } from "@/lib/storefront/products";
import { loginAction, logoutAction, registerAction, type RegisterErrors } from "../actions";
import { ERROR_STYLE, Field } from "./field";

/** Prijavljeni kupac, kako ga stranica naloga pročita iz CRM-a. */
export type Account = {
  firstName: string;
  email: string;
  /** Kod dobrodošlice, dok je aktivan u CRM-u. */
  welcomeCode: string | null;
  orders: {
    number: string;
    date: string;
    status: string;
    payment: string;
    total: number;
    count: number;
    names: string;
  }[];
};

const formStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: "22px", animationDelay: "0s" };
const headStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: "8px" };
const checkStyle: CSSProperties = { width: "18px", height: "18px", accentColor: "#0E2730" };

/** Desna kolona stranice naloga: prijava i registracija, a posle prijave pregled naloga. */
export function AccountPanel({ account }: { account: Account | null }) {
  const [tab, setTab] = useState<"login" | "reg">("login");
  const login = tab === "login";

  return (
    <div style={{ maxWidth: "470px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "30px" }}>
      {account ? (
        <Overview account={account} />
      ) : (
        <>
          <div className="seg" role="tablist" style={{ alignSelf: "flex-start" }}>
            <button role="tab" aria-selected={login} className={login ? "chip on" : "chip"} onClick={() => setTab("login")}>
              Prijava
            </button>
            <button role="tab" aria-selected={!login} className={login ? "chip" : "chip on"} onClick={() => setTab("reg")}>
              Registracija
            </button>
          </div>
          {login ? <LoginForm toReg={() => setTab("reg")} /> : <RegisterForm />}
        </>
      )}
    </div>
  );
}

function LoginForm({ toReg }: { toReg: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await loginAction({ email, password, remember });
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <form className="a1" style={formStyle} onSubmit={submit} noValidate>
      <div style={headStyle}>
        <h1 className="display h-l">Dobro došli nazad</h1>
        <p className="muted">Prijavite se da biste pratili porudžbine i sačuvane modele.</p>
      </div>
      <Field id="l-email" label="Email adresa" type="email" autoComplete="email" placeholder="ime@primer.rs" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
      <Field id="l-pass" label="Lozinka" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", fontSize: "15px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "44px", cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ ...checkStyle, margin: 0 }} /> Zapamti me
        </label>
        <Link className="ul keep" href="/kontakt">Zaboravljena lozinka?</Link>
      </div>
      {error && <p role="alert" style={ERROR_STYLE}>{error}</p>}
      <button className="btn full" type="submit" disabled={pending}>Prijavi se</button>
      <button className="btn ghost full" type="button" onClick={() => setError("Prijava Google nalogom još nije povezana. Prijavite se email adresom.")}>
        Nastavi sa Google nalogom
      </button>
      <p className="muted" style={{ fontSize: "15px", textAlign: "center" }}>
        Nemate nalog?{" "}
        <button className="txt-btn" type="button" onClick={toReg} style={{ color: "#0E2730", fontSize: "15px" }}>
          Registrujte se
        </button>
      </p>
    </form>
  );
}

function RegisterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [news, setNews] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const set = (name: keyof typeof fields) => (event: { target: { value: string } }) => {
    setFields({ ...fields, [name]: event.target.value });
    if (errors[name]) setErrors({ ...errors, [name]: undefined });
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await registerAction({ ...fields, news });
      if (result.ok) router.refresh();
      else setErrors(result.errors);
    });
  }

  return (
    <form className="a1" style={formStyle} onSubmit={submit} noValidate>
      <div style={headStyle}>
        <h1 className="display h-l">Napravite nalog</h1>
        <p className="muted">Brža kupovina, praćenje isporuke i 10% popusta na prvu porudžbinu.</p>
      </div>
      <div className="fgrid">
        <Field id="r-name" label="Ime" type="text" autoComplete="given-name" value={fields.firstName} onChange={set("firstName")} error={errors.firstName} />
        <Field id="r-last" label="Prezime" type="text" autoComplete="family-name" value={fields.lastName} onChange={set("lastName")} error={errors.lastName} />
      </div>
      <Field id="r-email" label="Email adresa" type="email" autoComplete="email" placeholder="ime@primer.rs" value={fields.email} onChange={set("email")} error={errors.email} />
      <Field id="r-pass" label="Lozinka" type="password" autoComplete="new-password" placeholder="Najmanje 8 karaktera" value={fields.password} onChange={set("password")} error={errors.password} />
      <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "15px", cursor: "pointer", minHeight: "44px" }}>
        <input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} style={{ ...checkStyle, margin: "3px 0 0", flexShrink: 0 }} />{" "}
        <span>Želim da primam novosti i ponude na email.</span>
      </label>
      <button className="btn full" type="submit" disabled={pending}>Napravi nalog</button>
      <p className="muted" style={{ fontSize: "14px", textAlign: "center" }}>
        Registracijom prihvatate <Link href="/pitanja">uslove korišćenja</Link> i <Link href="/pitanja">politiku privatnosti</Link>.
      </p>
    </form>
  );
}

/** Pregled naloga posle prijave. U dizajnu ne postoji, pa je složen od postojećih elemenata. */
function Overview({ account }: { account: Account }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="a1" style={formStyle}>
      <div style={headStyle}>
        <h1 className="display h-l">Zdravo, {account.firstName}</h1>
        <p className="muted">{account.email}</p>
      </div>

      {account.welcomeCode && (
        <div className="panel" style={{ padding: "18px 22px", borderRadius: "20px", fontSize: "15.5px" }}>
          Vaš kod za 10% popusta na prvu porudžbinu: <strong>{account.welcomeCode}</strong>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="display h-s">Vaše porudžbine</h2>
          <span className="muted" style={{ fontSize: "15px" }}>{account.orders.length}</span>
        </div>
        {account.orders.length === 0 && <p className="muted">Još nemate porudžbina.</p>}
        {account.orders.map((order) => (
          <div className="panel" style={{ padding: "16px 20px", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "4px" }} key={order.number}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <span className="card-name" style={{ fontSize: "17px" }}>
                Porudžbina {order.number} · {order.status}
              </span>
              <span style={{ fontFamily: "var(--display)", fontWeight: 700, whiteSpace: "nowrap" }}>{formatPrice(order.total)}</span>
            </div>
            <div className="muted" style={{ fontSize: "14px" }}>
              {order.date} · {countLabel(order.count)} · {order.payment}
            </div>
            <div className="muted" style={{ fontSize: "14px" }}>{order.names}</div>
          </div>
        ))}
      </div>

      <Link className="btn full" href="/kolekcija">Nastavite kupovinu</Link>
      <button
        className="btn ghost full"
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await logoutAction();
            router.refresh();
          })
        }
      >
        Odjavi se
      </button>
    </div>
  );
}
