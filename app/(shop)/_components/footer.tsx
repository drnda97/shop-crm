import Link from "next/link";
import type { CSSProperties } from "react";

const column: CSSProperties = { display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" };

export function Footer() {
  return (
    <footer
      className="ds"
      style={{ fontFamily: "var(--sans)", color: "#0E2730", background: "#F2F3F0", overflow: "hidden", borderRadius: "44px 44px 0 0" }}
    >
      <div className="wrap" style={{ paddingTop: "clamp(56px, 6vw, 88px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))", gap: "40px 32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Link className="logo" href="/">
              <b></b>Demo Shop
            </Link>
            <p className="muted" style={{ maxWidth: "30ch", fontSize: "15.5px" }}>
              Nameštaj od masivnog drveta i prirodnih tkanina, izrađen u malim serijama.
            </p>
          </div>
          <nav aria-label="Kupovina" style={column}>
            <div className="lab" style={{ marginBottom: "8px" }}>Kupovina</div>
            <Link className="ul muted" href="/kolekcija">Sve kolekcije</Link>
            <Link className="ul muted" href="/kolekcija?kategorija=Fotelje">Fotelje</Link>
            <Link className="ul muted" href="/kolekcija?kategorija=Stolice">Stolice</Link>
            <Link className="ul muted" href="/kolekcija?kategorija=Barske">Barske stolice</Link>
          </nav>
          <nav aria-label="Pomoć" style={column}>
            <div className="lab" style={{ marginBottom: "8px" }}>Pomoć</div>
            <Link className="ul muted" href="/pitanja">Česta pitanja</Link>
            <Link className="ul muted" href="/pitanja?tema=Dostava">Dostava i povrat</Link>
            <Link className="ul muted" href="/kontakt">Kontakt</Link>
            <Link className="ul muted" href="/nalog">Moj nalog</Link>
          </nav>
          <nav aria-label="Kompanija" style={column}>
            <div className="lab" style={{ marginBottom: "8px" }}>Kompanija</div>
            <Link className="ul muted" href="/o-nama">O nama</Link>
            <Link className="ul muted" href="/o-nama#proces">Naš proces</Link>
            <Link className="ul muted" href="/kontakt#salon">Salon</Link>
          </nav>
          <div style={column}>
            <div className="lab" style={{ marginBottom: "8px" }}>Pratite nas</div>
            <Link className="ul muted" href="/kontakt">Instagram</Link>
            <Link className="ul muted" href="/kontakt">Pinterest</Link>
            <Link className="ul muted" href="/kontakt">[EMAIL ADRESA]</Link>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: "clamp(40px, 5vw, 72px)" }}>
        <div className="foot-mark" aria-hidden="true">Demo Shop</div>
      </div>

      <div className="wrap">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 32px", justifyContent: "space-between", padding: "26px 0 30px", fontSize: "14px", color: "#56666B" }}>
          <span>© 2026 Demo Shop. Sva prava zadržana.</span>
          <span>Visa, Mastercard, Dina, pouzećem</span>
          <span style={{ display: "flex", gap: "24px" }}>
            <Link className="ul" href="/pitanja">Uslovi korišćenja</Link>
            <Link className="ul" href="/pitanja">Privatnost</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
