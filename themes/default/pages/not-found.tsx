import { getShopPath, getShopT } from "@/lib/i18n/server";
import Link from "next/link";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { ArrowIcon, DS_STYLE } from "../components/ui";

/** Stranica koja ne postoji: pogrešna adresa, obrisan proizvod, kolekcija ili članak. */
export async function NotFoundPage() {
  const to = await getShopPath();
  const t = await getShopT();
  return (
    <div className="ds" style={DS_STYLE}>
      <title>{t("Stranica nije pronađena")}</title>
      <Header />
      <section style={{ padding: "clamp(56px, 9vw, 140px) 0 clamp(72px, 10vw, 156px)" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "22px", alignItems: "flex-start" }}>
          <span className="over">{t("Greška 404")}</span>
          <h1 className="display h-l">{t("Ova stranica ne postoji")}</h1>
          <p className="lead" style={{ maxWidth: "52ch" }}>
            {t("Možda je proizvod uklonjen sa sajta ili je adresa pogrešno upisana. Pogledajte kolekciju ili potražite ono što vam treba.")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" }}>
            <Link className="btn" href={to("/kolekcija")}>
              {t("Pogledajte kolekciju")}
              <i>
                <ArrowIcon />
              </i>
            </Link>
            <Link className="btn ghost" href={to("/kolekcija?pretraga=1")}>
              {t("Pretraga")}
            </Link>
            <Link className="btn ghost" href={to("/")}>
              {t("Na početnu")}
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
