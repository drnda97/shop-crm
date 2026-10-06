import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { ArrowIcon, DS_STYLE, LeafIcon, Photo, ShieldIcon } from "../_components/ui";

export const metadata: Metadata = { title: "Demo Shop — O nama" };

const valueCard: CSSProperties = { display: "flex", flexDirection: "column", gap: "14px" };
const step: CSSProperties = { display: "flex", gap: "20px", padding: "22px 0", borderTop: "1px solid rgba(14, 39, 48, .1)" };
const stepNumber: CSSProperties = { color: "#8F6200", minWidth: "28px" };

export default function AboutPage() {
  return (
    <div className="ds" style={DS_STYLE}>
      <Header />

      {/* UVOD */}
      <section style={{ padding: "clamp(48px, 6vw, 96px) 0 clamp(32px, 4vw, 56px)" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "24px 64px" }}>
          <h1 className="display h-xl" style={{ maxWidth: "12ch" }}>
            <span className="ln"><span>Pravimo nameštaj</span></span>
            <span className="ln"><span className="d2">koji se nasleđuje.</span></span>
          </h1>
          <p className="lead a1" style={{ maxWidth: "40ch", paddingBottom: "10px" }}>
            Demo Shop je nastao iz jedne radionice i uverenja da stolica treba da traje duže od kredita kojim je kupljena.
          </p>
        </div>
      </section>

      <div className="wrap">
        <div className="ph" style={{ borderRadius: "36px", aspectRatio: "16 / 8", minHeight: "280px" }}>
          <Photo
            className="img kb"
            src="/shop/ds-living-window.jpg"
            alt="Dnevna soba sa kožnom ugaonom sofom i pogledom na baštu"
            sizes="(max-width: 1320px) 100vw, 1240px"
            position="center 60%"
            preload
          />
        </div>
      </div>

      {/* PRIČA */}
      <section className="sec">
        <div className="wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: "clamp(28px, 5vw, 96px)" }}>
          <h2 className="display h-l rv">Počeli smo sa jednim stolom i tri majstora</h2>
          <div className="rv t1" style={{ display: "flex", flexDirection: "column", gap: "20px", color: "#56666B", maxWidth: "58ch" }}>
            <p>
              Radimo sa malim radionicama koje poznajemo lično. Svaki komad prolazi kroz naše ruke pre nego što stigne do vas, i svaki nosi ime majstora koji ga je sastavio.
            </p>
            <p>
              Ne pratimo sezone. Kolekciju dopunjujemo samo kada napravimo nešto što zaslužuje mesto u njoj, a ono što jednom uvrstimo ostaje u ponudi godinama, zajedno sa rezervnim delovima.
            </p>
            <p style={{ color: "#0E2730" }}>[Ovde dopunite priču svog brenda: godina osnivanja, ko stoji iza prodavnice i šta vas izdvaja.]</p>
          </div>
        </div>
      </section>

      {/* VREDNOSTI */}
      <section style={{ paddingBottom: "clamp(72px, 9vw, 136px)" }}>
        <div className="wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "20px" }}>
          <div className="panel rv" style={valueCard}>
            <span className="icon-c" style={{ background: "#FFFFFF" }}><LeafIcon /></span>
            <h3 className="display h-m" style={{ marginTop: "12px" }}>Materijal</h3>
            <p className="muted">Masivno drvo iz kontrolisane seče, vuna, lan i biljno štavljena koža. Bez iverice i bez plastike na vidljivim mestima.</p>
          </div>
          <div className="panel rv t1" style={valueCard}>
            <span className="icon-c" style={{ background: "#FFFFFF" }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3l5 5-9 9-6 1 1-6z"></path>
                <path d="M12 5l5 5"></path>
              </svg>
            </span>
            <h3 className="display h-m" style={{ marginTop: "12px" }}>Izrada</h3>
            <p className="muted">Male serije i ručna završna obrada. Spojevi su klasični stolarski, pa se svaki deo može rastaviti i popraviti.</p>
          </div>
          <div className="panel rv t2" style={{ ...valueCard, background: "#0E2730", color: "#F3F5F4" }}>
            <span className="icon-c" style={{ background: "#E3A72F", color: "#0E2730" }}><ShieldIcon /></span>
            <h3 className="display h-m" style={{ marginTop: "12px" }}>Odgovornost</h3>
            <p style={{ color: "#B9C6C9" }}>Pet godina garancije na svaki komad i deset godina dostupnosti rezervnih delova. Stojimo iza svega što prodamo.</p>
          </div>
        </div>
      </section>

      {/* PROCES: stvarni redosled, pa su koraci numerisani */}
      <section id="proces" style={{ paddingBottom: "clamp(72px, 9vw, 136px)" }}>
        <div className="wrap split">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px", alignItems: "start" }}>
            <div className="ph zoom rv" style={{ aspectRatio: "3 / 4" }}>
              <Photo src="/shop/ds-wood-b.jpg" alt="Ručno dletovanje drveta" sizes="(max-width: 900px) 50vw, 300px" />
            </div>
            <div className="ph zoom rv t1" style={{ aspectRatio: "3 / 4", marginTop: "56px" }}>
              <Photo src="/shop/ds-detail-a.jpg" alt="Detalj stolice od trske" sizes="(max-width: 900px) 50vw, 300px" />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
            <h2 className="display h-l rv">Od daske do vašeg doma</h2>
            <ol className="rv t1" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
              <li style={step}>
                <span className="display h-s" style={stepNumber}>1</span>
                <div>
                  <div className="display h-s">Crtež i prototip</div>
                  <p className="muted" style={{ marginTop: "4px" }}>Svaki model mesecima koristimo u sopstvenim domovima pre nego što uđe u ponudu.</p>
                </div>
              </li>
              <li style={step}>
                <span className="display h-s" style={stepNumber}>2</span>
                <div>
                  <div className="display h-s">Izrada po porudžbini</div>
                  <p className="muted" style={{ marginTop: "4px" }}>Birate tkaninu i drvo, a mi komad pravimo za vas. Bez zaliha koje završavaju na rasprodaji.</p>
                </div>
              </li>
              <li style={{ ...step, borderBottom: "1px solid rgba(14, 39, 48, .1)" }}>
                <span className="display h-s" style={stepNumber}>3</span>
                <div>
                  <div className="display h-s">Dostava i montaža</div>
                  <p className="muted" style={{ marginTop: "4px" }}>Naš tim unosi, sastavlja i odnosi ambalažu. Vi samo sednete.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* POZIV */}
      <section style={{ paddingBottom: "clamp(48px, 6vw, 88px)" }}>
        <div className="wrap">
          <div className="ph rv" style={{ borderRadius: "36px", minHeight: "460px", display: "flex", alignItems: "flex-end", color: "#FFFFFF", background: "#0A1E25" }}>
            <Photo src="/shop/ds-green-sofa.jpg" alt="Zelena sofa" sizes="(max-width: 1320px) 100vw, 1240px" position="center 55%" />
            <div style={{ position: "absolute", inset: 0, background: "rgba(8, 22, 28, .4)" }}></div>
            <div
              style={{
                position: "relative",
                width: "100%",
                padding: "clamp(28px, 5vw, 64px)",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: "24px 48px",
              }}
            >
              <h2 className="display h-l" style={{ maxWidth: "14ch" }}>Pogledajte šta smo napravili</h2>
              <Link className="btn gold" href="/kolekcija">
                Otvorite kolekciju
                <i><ArrowIcon /></i>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
