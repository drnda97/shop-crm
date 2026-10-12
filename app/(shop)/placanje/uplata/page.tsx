import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";
import { CheckIcon, DS_STYLE } from "../../_components/ui";

export const metadata: Metadata = { title: "Plaćanje karticom", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ porudzbina?: string; ishod?: string }> };

/** Stranica na koju se kupac vraća posle plaćanja karticom. Podatke porudžbine ne prikazuje: adresa nije tajna. */
export default async function PaymentResultPage({ searchParams }: Props) {
  const { porudzbina = "", ishod } = await searchParams;
  const number = /^\d{1,10}$/.test(porudzbina) ? porudzbina : "";
  const paid = ishod === "uspeh";

  return (
    <div className="ds" style={DS_STYLE}>
      <Header />
      <section style={{ padding: "clamp(48px, 7vw, 112px) 0 clamp(72px, 9vw, 136px)" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "22px", alignItems: "flex-start", maxWidth: "760px" }}>
          {paid && (
            <span className="icon-c a1" style={{ background: "var(--gold)", color: "var(--on-gold)" }}>
              <CheckIcon />
            </span>
          )}
          <h1 className="display h-l">
            <span className="ln"><span>{paid ? "Hvala, uplata je primljena" : "Uplata nije prošla"}</span></span>
          </h1>
          <p className="lead a1">
            {paid
              ? `Porudžbina${number ? ` broj ${number}` : ""} je plaćena. Potvrdu ste dobili na email.`
              : `Porudžbina${number ? ` broj ${number}` : ""} je sačuvana, ali nije plaćena. Javite nam se da je platite drugim načinom, ili poručite ponovo.`}
          </p>
          <div className="a2" style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <Link className="btn" href="/kolekcija">Nastavite kupovinu</Link>
            {!paid && <Link className="btn ghost" href="/kontakt">Kontakt</Link>}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
