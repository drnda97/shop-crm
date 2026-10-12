import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findProvider, signPayment } from "@/lib/payments";
import { formatPrice } from "@/lib/storefront/products";
import { DS_STYLE } from "../../_components/ui";

export const metadata: Metadata = { title: "Probno plaćanje", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ porudzbina?: string; iznos?: string; potpis?: string }> };

/**
 * Stranica probnog procesora kartica (lib/payments.ts): stoji umesto stranice banke dok pravi
 * procesor nije povezan. Postoji samo dok je uključen CARD_TEST_PROVIDER.
 */
export default async function TestCardPage({ searchParams }: Props) {
  const { porudzbina = "", iznos = "", potpis = "" } = await searchParams;
  if (!findProvider("test")?.ready() || potpis !== (await signPayment(porudzbina, "start"))) notFound();
  const signatures = { uspeh: await signPayment(porudzbina, "uspeh"), odbijeno: await signPayment(porudzbina, "odbijeno") };
  const link = (outcome: "uspeh" | "odbijeno") =>
    `/api/v1/payments/test?porudzbina=${encodeURIComponent(porudzbina)}&ishod=${outcome}&potpis=${signatures[outcome]}`;

  return (
    <div className="ds" style={DS_STYLE}>
      <section style={{ padding: "clamp(48px, 8vw, 120px) 0" }}>
        <div className="wrap" style={{ maxWidth: "620px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="over">Probni procesor</div>
            <h1 className="display h-m">Plaćanje porudžbine {porudzbina}</h1>
            <p className="lead">
              Iznos: <strong style={{ color: "var(--ink)" }}>{formatPrice(Number(iznos) || 0)}</strong>. Ovo je proba: ništa se ne naplaćuje.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <a className="btn gold" href={link("uspeh")}>Uplati</a>
              <a className="btn ghost" href={link("odbijeno")}>Odbij uplatu</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
