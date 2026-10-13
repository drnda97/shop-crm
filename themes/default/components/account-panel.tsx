"use client";

import { usePath } from "@/lib/i18n/client";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { countLabel, formatPrice } from "@/lib/storefront/products";
import { loginAction, logoutAction, registerAction, type RegisterErrors } from "@/app/(shop)/actions";
import { useCart } from "./cart";
import type { ShopAddress } from "@/lib/storefront/auth";
import { AddressForm, DeleteAccount } from "./account-extras";
import { ERROR_STYLE, Field } from "./field";

/** Prijavljeni kupac, kako ga stranica naloga pročita iz CRM-a. */
export type Account = {
  firstName: string;
  email: string;
  /** Kod dobrodošlice, dok je aktivan u CRM-u. */
  welcomeCode: string | null;
  /** Adresa sačuvana uz nalog; popunjava formu pri poručivanju. */
  address: ShopAddress;
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
const checkStyle: CSSProperties = { width: "18px", height: "18px", accentColor: "var(--ink)" };

/** Desna kolona stranice naloga: prijava i registracija, a posle prijave pregled naloga. */
export function AccountPanel({ account }: { account: Account | null }) {
  const t = useT();
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
              {t("Prijava")}
            </button>
            <button role="tab" aria-selected={!login} className={login ? "chip" : "chip on"} onClick={() => setTab("reg")}>
              {t("Registracija")}
            </button>
          </div>
          {login ? <LoginForm toReg={() => setTab("reg")} /> : <RegisterForm />}
        </>
      )}
    </div>
  );
}

function LoginForm({ toReg }: { toReg: () => void }) {
  const to = usePath();
  const t = useT();
  const { texts: allTexts, googleLogin } = useCart().config;
  const texts = allTexts.account;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  // Neuspela prijava preko Google naloga vraća na ovu stranicu sa ?greska=google.
  const googleFailed = useSearchParams().get("greska") === "google";
  const [error, setError] = useState(googleFailed ? t("Prijava preko Google naloga nije uspela. Pokušajte ponovo.") : "");

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await loginAction({ email, password, remember });
      if (result.ok) router.refresh();
      else setError(t(result.error));
    });
  }

  return (
    <form className="a1" style={formStyle} onSubmit={submit} noValidate>
      <div style={headStyle}>
        <h1 className="display h-l">{texts.loginHeading}</h1>
        <p className="muted">{texts.loginText}</p>
      </div>
      <Field id="l-email" label={t("Email adresa")} type="email" autoComplete="email" placeholder={t("ime@primer.rs")} value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
      <Field id="l-pass" label={t("Lozinka")} type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", fontSize: "15px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "44px", cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ ...checkStyle, margin: 0 }} /> {t("Zapamti me")}
        </label>
        <Link className="ul keep" href={to("/nalog/lozinka")}>{t("Zaboravljena lozinka?")}</Link>
      </div>
      {error && <p role="alert" style={ERROR_STYLE}>{error}</p>}
      <button className="btn full" type="submit" disabled={pending}>{t("Prijavi se")}</button>
      {googleLogin && (
        // Običan link, ne <Link>: adresa je ruta na serveru koja šalje kupca Google-u.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a className="btn ghost full" href="/api/auth/google">{t("Nastavi sa Google nalogom")}</a>
      )}
      <p className="muted" style={{ fontSize: "15px", textAlign: "center" }}>
        {t("Nemate nalog?")}{" "}
        <button className="txt-btn" type="button" onClick={toReg} style={{ color: "var(--ink)", fontSize: "15px" }}>
          {t("Registrujte se")}
        </button>
      </p>
    </form>
  );
}

function RegisterForm() {
  const to = usePath();
  const t = useT();
  const texts = useCart().config.texts.account;
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
        <h1 className="display h-l">{texts.registerHeading}</h1>
        <p className="muted">{texts.registerText}</p>
      </div>
      <div className="fgrid">
        <Field id="r-name" label={t("Ime")} type="text" autoComplete="given-name" value={fields.firstName} onChange={set("firstName")} error={errors.firstName} />
        <Field id="r-last" label={t("Prezime")} type="text" autoComplete="family-name" value={fields.lastName} onChange={set("lastName")} error={errors.lastName} />
      </div>
      <Field id="r-email" label={t("Email adresa")} type="email" autoComplete="email" placeholder={t("ime@primer.rs")} value={fields.email} onChange={set("email")} error={errors.email} />
      <Field id="r-pass" label={t("Lozinka")} type="password" autoComplete="new-password" placeholder={t("Najmanje 8 karaktera")} value={fields.password} onChange={set("password")} error={errors.password} />
      <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "15px", cursor: "pointer", minHeight: "44px" }}>
        <input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} style={{ ...checkStyle, margin: "3px 0 0", flexShrink: 0 }} />{" "}
        <span>{t("Želim da primam novosti i ponude na email.")}</span>
      </label>
      <button className="btn full" type="submit" disabled={pending}>{t("Napravi nalog")}</button>
      <p className="muted" style={{ fontSize: "14px", textAlign: "center" }}>
        {t("Registracijom prihvatate")} <Link href={to(texts.termsHref || "/")}>{t("uslove korišćenja")}</Link> {t("i")} <Link href={to(texts.privacyHref || "/")}>{t("politiku privatnosti")}</Link>.
      </p>
    </form>
  );
}

/** Pregled naloga posle prijave. U dizajnu ne postoji, pa je složen od postojećih elemenata. */
function Overview({ account }: { account: Account }) {
  const to = usePath();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="a1" style={formStyle}>
      <div style={headStyle}>
        <h1 className="display h-l">{t("Zdravo, {ime}", { ime: account.firstName })}</h1>
        <p className="muted">{account.email}</p>
      </div>

      {account.welcomeCode && (
        <div className="panel" style={{ padding: "18px 22px", borderRadius: "20px", fontSize: "15.5px" }}>
          {t("Vaš kod za 10% popusta na prvu porudžbinu:")} <strong>{account.welcomeCode}</strong>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="display h-s">{t("Vaše porudžbine")}</h2>
          <span className="muted" style={{ fontSize: "15px" }}>{account.orders.length}</span>
        </div>
        {account.orders.length === 0 && <p className="muted">{t("Još nemate porudžbina.")}</p>}
        {account.orders.map((order) => (
          <div className="panel" style={{ padding: "16px 20px", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "4px" }} key={order.number}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <span className="card-name" style={{ fontSize: "17px" }}>
                {t("Porudžbina {broj}", { broj: order.number })} · {t(order.status)}
              </span>
              <span style={{ fontFamily: "var(--display)", fontWeight: 700, whiteSpace: "nowrap" }}>{formatPrice(order.total)}</span>
            </div>
            <div className="muted" style={{ fontSize: "14px" }}>
              {order.date} · {t(countLabel(order.count))} · {t(order.payment)}
            </div>
            <div className="muted" style={{ fontSize: "14px" }}>{order.names}</div>
            <div style={{ fontSize: "14px", display: "flex", flexWrap: "wrap", gap: "4px 18px" }}>
              <Link className="ul" href={to(`/pracenje?broj=${order.number}`)}>{t("Praćenje i povrat")}</Link>
              <a className="ul" href={to(`/nalog/racun/${order.number}`)} target="_blank" rel="noreferrer">{t("Račun (PDF)")}</a>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2 className="display h-s">{t("Adresa za dostavu")}</h2>
        <AddressForm address={account.address} />
      </div>

      <Link className="btn full" href={to("/kolekcija")}>{t("Nastavite kupovinu")}</Link>
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
        {t("Odjavi se")}
      </button>
      <div style={{ textAlign: "center" }}>
        <DeleteAccount />
      </div>
    </div>
  );
}
