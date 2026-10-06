import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ContactForm } from "../_components/contact-form";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { CONTACT_TOPICS, type ContactTopic } from "../_components/topics";
import { ArrowIcon, DS_STYLE, Photo } from "../_components/ui";

export const metadata: Metadata = { title: "Demo Shop — Kontakt" };

type Props = { searchParams: Promise<{ tema?: string }> };

// Linkovi „Poručite uzorke" i „Zakažite savet" otvaraju formu sa izabranom temom.
const TOPIC_LINKS: Record<string, ContactTopic> = {
  uzorci: "Uzorci tkanina",
  savet: "Savet dizajnera",
};

const infoRow: CSSProperties = { display: "flex", gap: "16px", alignItems: "center" };
const infoLabel: CSSProperties = { fontSize: "14.5px" };
const hoursRow: CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px" };
const iconStroke = { fill: "none", stroke: "currentColor", strokeWidth: "1.600", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export default async function ContactPage({ searchParams }: Props) {
  const { tema } = await searchParams;
  const topic = TOPIC_LINKS[tema ?? ""] ?? CONTACT_TOPICS[0];

  return (
    <div className="ds" style={DS_STYLE}>
      <Header />

      <section style={{ padding: "clamp(48px, 6vw, 96px) 0 clamp(28px, 4vw, 48px)" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "20px 64px" }}>
          <h1 className="display h-xl">
            <span className="ln"><span>Javite se</span></span>
          </h1>
          <p className="lead a1" style={{ maxWidth: "38ch", paddingBottom: "10px" }}>
            Pitanje o modelu, uzorci tkanina ili savet oko rasporeda. Odgovaramo u roku od jednog radnog dana.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: "clamp(56px, 7vw, 104px)" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "stretch" }}>
          {/* FORMA */}
          <ContactForm initialTopic={topic} key={topic} />

          {/* PODACI */}
          <div className="panel a3" style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: "22px" }}>
            <div style={infoRow}>
              <span className="icon-c" style={{ background: "#FFFFFF" }}>
                <svg width="20" height="16" viewBox="0 0 20 16" {...iconStroke}>
                  <rect x="1" y="1" width="18" height="14" rx="3"></rect>
                  <path d="M2 3l8 6 8-6"></path>
                </svg>
              </span>
              <div>
                <div className="muted" style={infoLabel}>Email</div>
                <Link className="display h-s ul" href="/kontakt">[EMAIL ADRESA]</Link>
              </div>
            </div>
            <div style={infoRow}>
              <span className="icon-c" style={{ background: "#FFFFFF" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" {...iconStroke}>
                  <path d="M4 1h4l2 5-2.500 1.500a11 11 0 005 5L14 10l5 2v4a2 2 0 01-2 2A16 16 0 012 3a2 2 0 012-2z"></path>
                </svg>
              </span>
              <div>
                <div className="muted" style={infoLabel}>Telefon</div>
                <Link className="display h-s ul" href="/kontakt">[BROJ TELEFONA]</Link>
              </div>
            </div>
            <div style={infoRow}>
              <span className="icon-c" style={{ background: "#FFFFFF" }}>
                <svg width="18" height="22" viewBox="0 0 18 22" {...iconStroke}>
                  <path d="M9 21s8-7 8-12.500A8 8 0 001 8.500C1 14 9 21 9 21z"></path>
                  <circle cx="9" cy="8.500" r="3"></circle>
                </svg>
              </span>
              <div>
                <div className="muted" style={infoLabel}>Salon</div>
                <div className="display h-s">[ULICA I BROJ], [GRAD]</div>
              </div>
            </div>
            <div style={{ background: "#FFFFFF", borderRadius: "20px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
              <div className="lab">Radno vreme salona</div>
              <div style={hoursRow}>
                <span>Ponedeljak do petka</span>
                <span>[OD] do [DO]</span>
              </div>
              <div style={hoursRow}>
                <span>Subota</span>
                <span>[OD] do [DO]</span>
              </div>
              <div className="muted" style={hoursRow}>
                <span>Nedelja</span>
                <span>Zatvoreno</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="salon" style={{ paddingBottom: "clamp(48px, 6vw, 88px)" }}>
        <div className="wrap">
          <div className="ph rv" style={{ borderRadius: "36px", minHeight: "440px", display: "flex", alignItems: "flex-end", color: "#FFFFFF", background: "#0A1E25" }}>
            <Photo src="/shop/ds-living-art.jpg" alt="Izložbeni prostor sa sofom i foteljama" sizes="(max-width: 1320px) 100vw, 1240px" position="center 60%" />
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
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "560px" }}>
                <h2 className="display h-l">Dođite u salon</h2>
                <p style={{ color: "#DDE5E6" }}>Svi modeli su izloženi, a uzorke tkanina i drveta možete poneti kući.</p>
              </div>
              <Link className="btn light" href="/kontakt#salon">
                Otvori mapu
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
