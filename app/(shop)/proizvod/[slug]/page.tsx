import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShopProducts } from "@/lib/storefront/catalog";
import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";
import { ProductCard } from "../../_components/product-card";
import { ProductView } from "../../_components/product-view";
import { ArrowSmallIcon, DS_STYLE, Photo } from "../../_components/ui";

type Props = { params: Promise<{ slug: string }> };

// Preporuke iz dizajna; proizvod se ne preporučuje sam sebi.
const RELATED = ["hoklica-hrast", "stolica-oliva", "fotelja-skoljka", "stolica-lena", "okretna-fotelja-mio"];

const specLabel = { color: "#B9C6C9", fontSize: "14.5px" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = (await getShopProducts()).find((candidate) => candidate.slug === slug);
  return { title: product ? `Demo Shop — ${product.name}` : "Demo Shop" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const products = await getShopProducts();
  const product = products.find((candidate) => candidate.slug === slug);
  if (!product) notFound();

  // Preporuke iz dizajna, dopunjene ostalim proizvodima ako neke od njih više nema.
  const others = products.filter((candidate) => candidate.slug !== product.slug);
  const related = [
    ...RELATED.flatMap((id) => others.filter((candidate) => candidate.slug === id)),
    ...others.filter((candidate) => !RELATED.includes(candidate.slug)),
  ].slice(0, 4);

  return (
    <div className="ds" style={DS_STYLE}>
      <Header />

      <section style={{ padding: "28px 0 clamp(64px, 8vw, 120px)" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <nav className="crumbs" aria-label="Putanja">
            <Link href="/">Početna</Link>
            <span>/</span>
            <Link href={`/kolekcija?kategorija=${product.category}`}>{product.category}</Link>
            <span>/</span>
            <span style={{ color: "#0E2730" }}>{product.name}</span>
          </nav>

          <ProductView product={product} key={product.id} />
        </div>
      </section>

      {/* DETALJ */}
      <section>
        <div className="wrap">
          <div className="dark split rv" style={{ borderRadius: "36px", padding: "clamp(24px, 4vw, 64px)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              <h2 className="display h-l">Napravljena da se popravlja, ne da se baca</h2>
              <p className="lead">
                Navlaka se skida i pere, a sedište i postolje se menjaju posebno. Rezervne delove čuvamo deset godina.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(130px, 100%), 1fr))",
                  gap: "20px",
                  paddingTop: "20px",
                  borderTop: "1px solid rgba(243, 245, 244, .16)",
                }}
              >
                <div>
                  <div style={specLabel}>Širina</div>
                  <div className="display h-s" style={{ marginTop: "4px" }}>72 cm</div>
                </div>
                <div>
                  <div style={specLabel}>Visina sedišta</div>
                  <div className="display h-s" style={{ marginTop: "4px" }}>41 cm</div>
                </div>
                <div>
                  <div style={specLabel}>Nosivost</div>
                  <div className="display h-s" style={{ marginTop: "4px" }}>130 kg</div>
                </div>
              </div>
            </div>
            <div className="ph zoom" style={{ aspectRatio: "5 / 4" }}>
              <Photo src="/shop/ds-detail-a.jpg" alt="Detalj spoja drveta i pletene trske" sizes="(max-width: 900px) 100vw, 560px" />
            </div>
          </div>
        </div>
      </section>

      {/* PREPORUKE */}
      <section className="sec">
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(28px, 3.6vw, 48px)" }}>
          <div className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 40px" }}>
            <h2 className="display h-l">Lepo ide uz {product.slug === "okretna-fotelja-mio" ? "Mio" : "ovaj model"}</h2>
            <Link className="more" href="/kolekcija">
              Cela kolekcija <i><ArrowSmallIcon /></i>
            </Link>
          </div>
          <div className="grid">
            {related.map((p) => (
              <ProductCard product={p} key={p.id} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
