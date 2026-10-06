import Link from "next/link";
import type { CSSProperties } from "react";
import { BestSellers } from "./_components/best-sellers";
import { Footer } from "./_components/footer";
import { Header } from "./_components/header";
import { NewsletterForm } from "./_components/newsletter-form";
import { ArrowIcon, ArrowSmallIcon, DS_STYLE, LeafIcon, Photo, ShieldIcon, TruckIcon } from "./_components/ui";

const benefit: CSSProperties = { display: "flex", gap: "16px", alignItems: "flex-start" };
const benefitText: CSSProperties = { fontSize: "15.5px", marginTop: "4px" };
const tileLabel: CSSProperties = {
  position: "absolute",
  left: "14px",
  right: "14px",
  bottom: "14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  background: "rgba(255, 255, 255, .94)",
  borderRadius: "18px",
  padding: "14px 14px 14px 20px",
  color: "#0E2730",
};
const sectionStack: CSSProperties = { display: "flex", flexDirection: "column", gap: "clamp(28px, 3.6vw, 48px)" };
const textStack: CSSProperties = { display: "flex", flexDirection: "column", gap: "22px", alignItems: "flex-start" };

const rooms = [
  { cls: "ph zoom rv", image: "/shop/ds-cognac.jpg", alt: "Kožna sofa u dnevnoj sobi", title: "Dnevna soba", text: "Sofe, fotelje, stočići" },
  { cls: "ph zoom rv t1", image: "/shop/ds-dining-a.jpg", alt: "Trpezarijski sto sa belim stolicama", title: "Trpezarija", text: "Stolice, stolovi, klupe" },
  { cls: "ph zoom rv t2", image: "/shop/ds-armchair-plant.jpg", alt: "Fotelja od buklea pored stočića", title: "Kutak za čitanje", text: "Fotelje, hoklice, lampe" },
];

const reviews = [
  { cls: "rev rv", image: "/shop/ds-room.jpg", alt: "Dnevna soba sa velikim prozorima" },
  { cls: "rev rv t1", image: "/shop/ds-living-window.jpg", alt: "Svetla dnevna soba sa ugaonom sofom" },
  { cls: "rev rv t2", image: "/shop/ds-dining-b.jpg", alt: "Trpezarija sa okruglim stolom" },
];

export default function HomePage() {
  return (
    <div className="ds" style={DS_STYLE}>
      {/* HERO */}
      <section
        style={{
          position: "relative",
          minHeight: "840px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          color: "#FFFFFF",
          background: "#0A1E25",
          borderRadius: "0 0 44px 44px",
          overflow: "hidden",
        }}
      >
        <Photo className="img kb" src="/shop/ds-hero.jpg" alt="Senf žuta sofa ispred tamnog petrolej zida" sizes="100vw" position="70% 60%" preload />
        <div style={{ position: "absolute", inset: 0, background: "rgba(8, 22, 28, .22)" }}></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 20 }}>
          <Header />
        </div>

        <div
          className="wrap"
          style={{ position: "relative", width: "100%", paddingTop: "180px", paddingBottom: "148px", display: "flex", flexDirection: "column", gap: "28px", alignItems: "flex-start" }}
        >
          <h1 className="display h-xl" style={{ maxWidth: "11ch" }}>
            <span className="ln"><span>Komadi oko</span></span>
            <span className="ln"><span className="d2">kojih se</span></span>
            <span className="ln"><span className="d3">gradi dom.</span></span>
          </h1>
          <p className="a1" style={{ maxWidth: "40ch", fontSize: "clamp(17px, 1.4vw, 20px)", color: "#DDE5E6" }}>
            Fotelje, stolice i sofe od masivnog drveta i prirodnih tkanina, izrađene u malim serijama.
          </p>
          <div className="a2" style={{ display: "flex", flexWrap: "wrap", gap: "14px 22px", alignItems: "center" }}>
            <Link className="btn gold" href="/kolekcija">
              Pogledajte kolekciju
              <i><ArrowIcon /></i>
            </Link>
            <Link className="ul keep" href="/o-nama" style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: "16px" }}>
              Kako nastaje naš nameštaj
            </Link>
          </div>
        </div>

        <Link className="float-card hide-s a3" href="/kolekcija" style={{ right: "clamp(24px, 9vw, 150px)", top: "40%", color: "#0E2730" }}>
          <span className="dot" style={{ position: "relative", margin: 0, background: "#0E2730" }}></span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
            <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: "16px" }}>Sofa Senf</span>
            <span className="muted" style={{ fontSize: "14px" }}>189.000 RSD</span>
          </span>
        </Link>
      </section>

      {/* PREDNOSTI: kartica koja prelazi preko hero slike */}
      <div className="wrap" style={{ position: "relative", marginTop: "-76px" }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "30px",
            boxShadow: "0 30px 60px -30px rgba(14, 39, 48, .35)",
            padding: "clamp(24px, 3vw, 40px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))",
            gap: "28px 40px",
          }}
        >
          <div style={benefit}>
            <span className="icon-c"><LeafIcon /></span>
            <div>
              <h3 className="display h-s">Prirodni materijali</h3>
              <p className="muted" style={benefitText}>Masivno drvo, lan, vuna i koža koji lepo stare.</p>
            </div>
          </div>
          <div style={benefit}>
            <span className="icon-c"><TruckIcon /></span>
            <div>
              <h3 className="display h-s">Dostava do stana</h3>
              <p className="muted" style={benefitText}>Besplatna preko 50.000 RSD, sa unošenjem i montažom.</p>
            </div>
          </div>
          <div style={benefit}>
            <span className="icon-c"><ShieldIcon /></span>
            <div>
              <h3 className="display h-s">Pet godina garancije</h3>
              <p className="muted" style={benefitText}>I povrat u roku od 30 dana ako se predomislite.</p>
            </div>
          </div>
        </div>
      </div>

      {/* KATEGORIJE */}
      <section className="sec" style={{ paddingBottom: 0 }}>
        <div className="wrap" style={sectionStack}>
          <div className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 40px" }}>
            <h2 className="display h-l">Počnite od prostorije</h2>
            <Link className="more" href="/kolekcija">
              Sve kategorije <i><ArrowSmallIcon /></i>
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "20px" }}>
            {rooms.map((room) => (
              <Link className={room.cls} href="/kolekcija" style={{ aspectRatio: "4 / 5" }} key={room.title}>
                <Photo src={room.image} alt={room.alt} sizes="(max-width: 700px) 100vw, 430px" />
                <span style={tileLabel}>
                  <span>
                    <span className="display h-s" style={{ display: "block" }}>{room.title}</span>
                    <span className="muted" style={{ fontSize: "14px" }}>{room.text}</span>
                  </span>
                  <span className="icon-c" style={{ width: "44px", height: "44px" }}><ArrowSmallIcon /></span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* NAJPRODAVANIJE */}
      <section className="sec">
        <BestSellers />
      </section>

      {/* ISKUSTVO */}
      <section className="sec" style={{ paddingTop: "24px" }}>
        <div className="wrap split">
          <div className="stack rv">
            <div className="ph zoom" style={{ aspectRatio: "5 / 4", boxShadow: "0 30px 60px -30px rgba(14, 39, 48, .35)" }}>
              <Photo src="/shop/ds-living-art.jpg" alt="Dnevna soba sa sofom, foteljama i umetničkom slikom" sizes="(max-width: 900px) 100vw, 620px" />
            </div>
          </div>
          <div style={textStack}>
            <div className="over rv">Usluga</div>
            <h2 className="display h-l rv t1">Pomažemo vam da zamislite ceo prostor</h2>
            <p className="lead rv t2">
              Pošaljite nam dimenzije i fotografije sobe. Naš dizajner predlaže raspored, tkanine i boje, bez naknade i bez obaveze kupovine.
            </p>
            <Link className="more rv t3" href="/kontakt?tema=savet">
              Zakažite savet <i><ArrowSmallIcon /></i>
            </Link>
          </div>
        </div>
      </section>

      {/* MATERIJALI */}
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap split">
          <div style={textStack}>
            <div className="over rv">Materijali</div>
            <h2 className="display h-l rv t1">Ozbiljni materijali za nameštaj koji traje</h2>
            <p className="lead rv t2">
              Radimo sa masivnim hrastom i orahom, pletenom trskom i tkaninama evropskih tkačnica. Svaki spoj se radi ručno i može da se popravi.
            </p>
            <Link className="more rv t3" href="/o-nama#proces">
              Naš proces <i><ArrowSmallIcon /></i>
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="ph zoom rv" style={{ aspectRatio: "1" }}>
                <Photo src="/shop/ds-detail-b.jpg" alt="Detalj drvenih letvica" sizes="(max-width: 900px) 50vw, 300px" />
              </div>
              <div className="ph zoom rv t1" style={{ aspectRatio: "5 / 4" }}>
                <Photo src="/shop/ds-wood-b.jpg" alt="Ručno dletovanje drveta" sizes="(max-width: 900px) 50vw, 300px" />
              </div>
            </div>
            <div className="ph zoom rv t2" style={{ aspectRatio: "3 / 5" }}>
              <Photo src="/shop/ds-detail-a.jpg" alt="Detalj stolice od trske i drveta" sizes="(max-width: 900px) 50vw, 300px" />
            </div>
          </div>
        </div>
      </section>

      {/* SALON */}
      <section>
        <div className="wrap">
          <div className="ph rv" style={{ borderRadius: "36px", minHeight: "520px", display: "flex", alignItems: "flex-end", color: "#FFFFFF", background: "#0A1E25" }}>
            <Photo src="/shop/ds-dark-sofa.jpg" alt="Tamna dnevna soba sa sivom sofom" sizes="(max-width: 1320px) 100vw, 1240px" position="center 70%" />
            <div style={{ position: "absolute", inset: 0, background: "rgba(8, 22, 28, .38)" }}></div>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "620px" }}>
                <h2 className="display h-l">Sedite pre nego što kupite</h2>
                <p style={{ color: "#DDE5E6", fontSize: "clamp(17px, 1.3vw, 19px)" }}>
                  Sve modele možete probati u našem salonu: [ADRESA SALONA], radnim danima od [OD] do [DO].
                </p>
              </div>
              <Link className="btn light" href="/kontakt#salon">
                Kako do nas
                <i><ArrowIcon /></i>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* UTISCI */}
      <section className="sec">
        <div className="wrap" style={sectionStack}>
          <h2 className="display h-l rv">Iz domova naših kupaca</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(290px, 100%), 1fr))", gap: "32px 20px" }}>
            {reviews.map((review) => (
              <figure className={review.cls} key={review.image}>
                <div className="ph" style={{ aspectRatio: "4 / 3" }}>
                  <Photo src={review.image} alt={review.alt} sizes="(max-width: 700px) 100vw, 430px" />
                </div>
                <div className="rev-card">
                  <blockquote style={{ margin: 0, fontSize: "16px" }}>
                    “[Utisak kupca: jedna do dve rečenice o proizvodu ili isporuci.]”
                  </blockquote>
                  <figcaption className="muted" style={{ fontSize: "14.5px" }}>
                    <strong style={{ color: "#0E2730" }}>[Ime kupca]</strong>, [Grad]
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section style={{ paddingBottom: "clamp(48px, 6vw, 88px)" }}>
        <div className="wrap">
          <div
            className="dark rv"
            style={{
              borderRadius: "36px",
              padding: "10px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))",
              gap: "10px",
              alignItems: "stretch",
            }}
          >
            <div style={{ padding: "clamp(24px, 4vw, 56px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: "26px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <h2 className="display h-l">Novi modeli stižu jednom mesečno</h2>
                <p className="lead">Prijavite se i javićemo vam pre svih, uz 10% popusta na prvu porudžbinu.</p>
              </div>
              <NewsletterForm />
            </div>
            <div className="ph zoom" style={{ borderRadius: "28px", minHeight: "340px" }}>
              <Photo src="/shop/ds-leather.jpg" alt="Kožna sofa u popodnevnom svetlu" sizes="(max-width: 900px) 100vw, 640px" position="30% center" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
