import type { Templates } from "@/lib/templates";
import { AccountPanel, type Account } from "../components/account-panel";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { DS_STYLE, Photo } from "../components/ui";

export type { Account };

/** Nalog kupca: /nalog. `account` je null dok kupac nije prijavljen; tekstovi su iz panela (Izgled sajta → Nalog kupca). */
export function AccountPage({ account, texts }: { account: Account | null; texts: Templates["account"] }) {
  return (
    <div className="ds" style={DS_STYLE}>
      <Header />

      <section style={{ padding: "16px 0 clamp(56px, 7vw, 104px)" }}>
        <div
          className="wrap"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(400px, 100%), 1fr))",
            gap: "clamp(24px, 4vw, 72px)",
            alignItems: "stretch",
          }}
        >
          {/* SLIKA */}
          <div className="ph" style={{ borderRadius: "36px", minHeight: "clamp(300px, 52vw, 760px)", color: "#FFFFFF", background: "var(--ink-deep)" }}>
            {texts.image.src && (
              <Photo className="img kb" src={texts.image.src} alt={texts.image.alt} sizes="(max-width: 900px) 100vw, 640px" position={texts.image.position || undefined} preload />
            )}
            <div style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--ink-deep) 30%, transparent)" }}></div>
            <div
              style={{
                position: "absolute",
                left: "clamp(22px, 3vw, 44px)",
                right: "clamp(22px, 3vw, 44px)",
                bottom: "clamp(22px, 3vw, 44px)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div className="display h-m a1" style={{ maxWidth: "15ch" }}>{texts.imageHeading}</div>
<p className="a2" style={{ color: "var(--on-dark-soft)", maxWidth: "38ch" }}>{texts.imageText}</p>
            </div>
          </div>

          {/* FORMA */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "clamp(8px, 2vw, 32px) 0" }}>
            <AccountPanel account={account} />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
