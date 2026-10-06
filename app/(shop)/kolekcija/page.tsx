import type { Metadata } from "next";
import Link from "next/link";
import { getShopConfig } from "@/lib/storefront/catalog";
import { CollectionGrid } from "../_components/collection-grid";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { ArrowIcon, DS_STYLE, Photo } from "../_components/ui";

export const metadata: Metadata = { title: "Demo Shop — Kolekcija" };

type Props = { searchParams: Promise<{ kategorija?: string; pretraga?: string }> };

export default async function CollectionPage({ searchParams }: Props) {
  const { kategorija, pretraga } = await searchParams;
  // Linkovi iz podnožja otvaraju kolekciju sa izabranom kategorijom, a lupa iz zaglavlja sa poljem za pretragu.
  const category = (await getShopConfig()).categories.find((c) => c === kategorija) ?? "Sve";
  const search = pretraga !== undefined;

  return (
    <div className="ds" style={DS_STYLE}>
      <Header />

      {/* BANER */}
      <section style={{ paddingTop: "16px" }}>
        <div className="wrap">
          <div className="ph" style={{ borderRadius: "36px", minHeight: "380px", display: "flex", alignItems: "flex-end", color: "#FFFFFF", background: "#0A1E25" }}>
            <Photo className="img kb" src="/shop/ds-green-sofa.jpg" alt="Zelena sofa u svetloj sobi" sizes="(max-width: 1320px) 100vw, 1240px" position="center 55%" preload />
            <div style={{ position: "absolute", inset: 0, background: "rgba(8, 22, 28, .42)" }}></div>
            <div
              style={{
                position: "relative",
                width: "100%",
                padding: "clamp(24px, 4vw, 56px)",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: "20px 48px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <nav className="crumbs a1" aria-label="Putanja" style={{ color: "#DDE5E6" }}>
                  <Link href="/">Početna</Link>
                  <span>/</span>
                  <span style={{ color: "#FFFFFF" }}>Kolekcija</span>
                </nav>
                <h1 className="display h-xl" style={{ fontSize: "clamp(42px, 5.6vw, 84px)" }}>
                  <span className="ln"><span>Sedenje</span></span>
                </h1>
              </div>
              <p className="a2" style={{ maxWidth: "36ch", color: "#DDE5E6" }}>
                Fotelje, stolice i barske stolice. Svaki model dolazi u više tkanina i završnih obrada drveta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FILTERI + MREŽA */}
      <section style={{ padding: "clamp(28px, 3.6vw, 48px) 0 clamp(72px, 9vw, 128px)" }}>
        <CollectionGrid initialCategory={category} search={search} key={`${category}-${search}`} />
      </section>

      {/* SAVET */}
      <section style={{ paddingBottom: "clamp(48px, 6vw, 88px)" }}>
        <div className="wrap">
          <div className="panel split rv">
            <div style={{ display: "flex", flexDirection: "column", gap: "18px", alignItems: "flex-start" }}>
              <h2 className="display h-l">Niste sigurni koja tkanina?</h2>
              <p className="lead">
                Šaljemo besplatne uzorke tkanina i drveta na vašu adresu, da ih vidite pri svom svetlu pre nego što poručite.
              </p>
              <Link className="btn" href="/kontakt?tema=uzorci">
                Poručite uzorke
                <i><ArrowIcon /></i>
              </Link>
            </div>
            <div className="ph zoom" style={{ aspectRatio: "16 / 10" }}>
              <Photo src="/shop/ds-leather.jpg" alt="Kožna sofa pored prozora" sizes="(max-width: 900px) 100vw, 600px" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
