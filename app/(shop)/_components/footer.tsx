import Link from "next/link";
import { getShopSettings } from "@/lib/storefront/pages";
import type { CSSProperties } from "react";

const column: CSSProperties = { display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" };

/** Podnožje: naziv i opis prodavnice, kolone linkova i donji red — sve iz panela (Izgled sajta). */
export async function Footer() {
  const { store, site } = await getShopSettings();
  const columns = site.footerColumns.filter((item) => item.links.length > 0);

  return (
    <footer
      className="ds"
      style={{ fontFamily: "var(--sans)", color: "var(--ink)", background: "var(--mist)", overflow: "hidden", borderRadius: "44px 44px 0 0" }}
    >
      <div className="wrap" style={{ paddingTop: "clamp(56px, 6vw, 88px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))", gap: "40px 32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Link className="logo" href="/">
              <b></b>
              {store.name}
            </Link>
            {site.tagline && (
              <p className="muted" style={{ maxWidth: "30ch", fontSize: "15.5px" }}>
                {site.tagline}
              </p>
            )}
          </div>
          {columns.map((item, index) => (
            <nav aria-label={item.title} style={column} key={index}>
              <div className="lab" style={{ marginBottom: "8px" }}>{item.title}</div>
              {item.links.map((link, position) => (
                <Link className="ul muted" href={link.href} key={position}>{link.label}</Link>
              ))}
            </nav>
          ))}
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: "clamp(40px, 5vw, 72px)" }}>
        <div className="foot-mark" aria-hidden="true">{store.name}</div>
      </div>

      <div className="wrap">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 32px", justifyContent: "space-between", padding: "26px 0 30px", fontSize: "14px", color: "var(--soft)" }}>
          <span>© {new Date().getFullYear()} {store.name}. Sva prava zadržana.</span>
          {site.footerNote && <span>{site.footerNote}</span>}
          {site.legalLinks.length > 0 && (
            <span style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px" }}>
              {site.legalLinks.map((link, index) => (
                <Link className="ul" href={link.href} key={index}>{link.label}</Link>
              ))}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
