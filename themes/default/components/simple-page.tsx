import type { ReactNode } from "react";
import { Footer } from "./footer";
import { Header } from "./header";
import { DS_STYLE } from "./ui";

/** Jednostavna stranica prodavnice: zaglavlje, naslov, sadržaj, podnožje. */
export function SimplePage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ds" style={DS_STYLE}>
      <Header />
      <section style={{ padding: "clamp(48px, 7vw, 112px) 0 clamp(72px, 9vw, 136px)" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "24px", alignItems: "flex-start" }}>
          <h1 className="display h-l">{title}</h1>
          {children}
        </div>
      </section>
      <Footer />
    </div>
  );
}
