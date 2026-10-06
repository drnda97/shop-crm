import type { Metadata } from "next";
import Link from "next/link";
import { FaqList } from "../_components/faq-list";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { FAQ_TOPICS, type FaqTopic } from "../_components/topics";
import { ArrowIcon, DS_STYLE } from "../_components/ui";

export const metadata: Metadata = { title: "Demo Shop — Česta pitanja" };

type Props = { searchParams: Promise<{ tema?: string }> };

export default async function FaqPage({ searchParams }: Props) {
  const { tema } = await searchParams;
  const topic: FaqTopic = FAQ_TOPICS.find((t) => t === tema) ?? "Sve";

  return (
    <div className="ds" style={DS_STYLE}>
      <Header />

      <section style={{ padding: "clamp(48px, 6vw, 96px) 0 clamp(28px, 4vw, 48px)" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "20px 64px" }}>
          <h1 className="display h-xl">
            <span className="ln"><span>Česta pitanja</span></span>
          </h1>
          <p className="lead a1" style={{ maxWidth: "36ch", paddingBottom: "10px" }}>
            Dostava, plaćanje, povrat i održavanje. Ako ne nađete odgovor, pišite nam.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: "clamp(72px, 9vw, 128px)" }}>
        <FaqList initialTopic={topic} key={topic} />
      </section>

      <section style={{ paddingBottom: "clamp(48px, 6vw, 88px)" }}>
        <div className="wrap">
          <div
            className="dark rv"
            style={{
              borderRadius: "36px",
              padding: "clamp(28px, 5vw, 64px)",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "28px 64px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: "1 1 420px" }}>
              <h2 className="display h-l">Niste našli odgovor?</h2>
              <p className="lead">Pišite nam ili pozovite. Odgovaramo istog radnog dana.</p>
            </div>
            <Link className="btn gold" href="/kontakt">
              Kontaktirajte nas
              <i><ArrowIcon /></i>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
