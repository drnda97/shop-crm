import type { Metadata } from "next";
import Link from "next/link";
import { getCartByToken } from "@/lib/abandoned";
import { Footer } from "../../../_components/footer";
import { Header } from "../../../_components/header";
import { DS_STYLE } from "../../../_components/ui";
import { RestoreCart } from "../../restore-cart";

export const metadata: Metadata = { title: "Vaša korpa", robots: { index: false, follow: false } };

/** Link iz podsetnika za napuštenu korpu: vraća sačuvane proizvode u korpu i vodi na plaćanje. */
export default async function RestoreCartPage({ params }: { params: Promise<{ token: string }> }) {
  const cart = await getCartByToken((await params).token);
  const items = (cart?.items ?? []).map((item) => ({ slug: item.slug, qty: item.qty, variantId: item.variant }));

  return (
    <div className="ds" style={DS_STYLE}>
      <Header />
      <section style={{ padding: "clamp(48px, 7vw, 112px) 0 clamp(72px, 9vw, 136px)" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "flex-start" }}>
          <h1 className="display h-l">Vaša korpa</h1>
          {items.length > 0 ? (
            <RestoreCart items={items} />
          ) : (
            <>
              <p className="lead">Ova korpa više nije sačuvana. Proizvode možete ponovo dodati iz kolekcije.</p>
              <Link className="btn" href="/kolekcija">Pogledajte kolekciju</Link>
            </>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
