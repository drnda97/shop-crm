import { getShopPath } from "@/lib/i18n/server";
import { getShopT } from "@/lib/i18n/server";
import Link from "next/link";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { CheckIcon, DS_STYLE } from "../components/ui";

/** Stranica na koju se kupac vraća posle plaćanja karticom: /placanje/uplata. `number` je prazan kada broj nije poznat. */
export async function PaymentResultPage({ number, paid }: { number: string; paid: boolean }) {
  const to = await getShopPath();
  const t = await getShopT();
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
            <span className="ln"><span>{paid ? t("Hvala, uplata je primljena") : t("Uplata nije prošla")}</span></span>
          </h1>
          <p className="lead a1">
            {paid
              ? number
                ? t("Porudžbina broj {broj} je plaćena. Potvrdu ste dobili na email.", { broj: number })
                : t("Porudžbina je plaćena. Potvrdu ste dobili na email.")
              : number
                ? t("Porudžbina broj {broj} je sačuvana, ali nije plaćena. Javite nam se da je platite drugim načinom, ili poručite ponovo.", { broj: number })
                : t("Porudžbina je sačuvana, ali nije plaćena. Javite nam se da je platite drugim načinom, ili poručite ponovo.")}
          </p>
          <div className="a2" style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <Link className="btn" href={to("/kolekcija")}>{t("Nastavite kupovinu")}</Link>
            {!paid && <Link className="btn ghost" href={to("/kontakt")}>{t("Kontakt")}</Link>}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
