import type { Metadata } from "next";
import { Footer } from "../../../_components/footer";
import { Header } from "../../../_components/header";
import { DS_STYLE } from "../../../_components/ui";
import { Unsubscribe } from "../../restore-cart";

export const metadata: Metadata = { title: "Odjava od podsetnika", robots: { index: false, follow: false } };

/** Link „Ne želim podsetnike" iz emaila o napuštenoj korpi. */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="ds" style={DS_STYLE}>
      <Header />
      <section style={{ padding: "clamp(48px, 7vw, 112px) 0 clamp(72px, 9vw, 136px)" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "flex-start" }}>
          <h1 className="display h-l">Podsetnici za korpu</h1>
          <Unsubscribe token={token} />
        </div>
      </section>
      <Footer />
    </div>
  );
}
