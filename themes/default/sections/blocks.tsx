import { getShopT } from "@/lib/i18n/server";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { paragraphs, type ImageValue } from "@/lib/sections";
import type { StoreSettings } from "@/lib/settings";
import { formatPrice, type ShopProduct } from "@/lib/storefront/products";
import { ContactForm } from "../components/contact-form";
import { FaqList } from "../components/faq-list";
import { Header } from "../components/header";
import { NewsletterForm } from "../components/newsletter-form";
import { ProductsBlock } from "../components/best-sellers";
import { CONTACT_TOPICS, type ContactTopic } from "@/lib/storefront/topics";
import { ArrowIcon, ArrowSmallIcon, CheckIcon, LeafIcon, PenIcon, Photo, ShieldIcon, TruckIcon } from "../components/ui";

/**
 * Izgled sekcija u ovoj temi. Sadržaj stiže iz panela (opis polja: lib/sections.ts);
 * ovde je samo raspored. Razmak ispod sekcije određuje page-view.tsx.
 */

type Query = Record<string, string | undefined>;

export type BlockProps<T> = {
  data: T;
  /** Oznaka za link (#…) i razmak do sledeće sekcije. */
  id?: string;
  bottom: string;
};

const sectionStack: CSSProperties = { display: "flex", flexDirection: "column", gap: "clamp(28px, 3.6vw, 48px)" };
const textStack: CSSProperties = { display: "flex", flexDirection: "column", gap: "22px", alignItems: "flex-start" };
const delay = ["", " t1", " t2", " t3"];

const icons: Record<string, ReactNode> = {
  leaf: <LeafIcon />,
  truck: <TruckIcon />,
  shield: <ShieldIcon />,
  pen: <PenIcon />,
  check: <CheckIcon />,
};

/** Fotografija iz panela; dok nije izabrana, okvir ostaje prazan. */
function Pic({ image, sizes, className, preload }: { image: ImageValue; sizes: string; className?: string; preload?: boolean }) {
  if (!image.src) return null;
  return <Photo className={className} src={image.src} alt={image.alt} sizes={sizes} position={image.position || undefined} preload={preload} />;
}

/** Veliki naslov: svaki red iz panela ulazi sa malim zakašnjenjem. */
function Lines({ text }: { text: string }) {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => (
      <span className="ln" key={index}>
        <span className={index === 0 ? undefined : index === 1 ? "d2" : "d3"}>{line}</span>
      </span>
    ));
}

/* ---------- Glavni baner ---------- */

type HeroData = { title: string; text: string; image: ImageValue; buttonLabel: string; buttonHref: string; linkLabel: string; linkHref: string; product: string };

export function Hero({ data, id, bottom, withHeader, products }: BlockProps<HeroData> & { withHeader: boolean; products: ShopProduct[] }) {
  const product = products.find((candidate) => candidate.slug === data.product);
  return (
    <section
      id={id}
      style={{
        position: "relative",
        minHeight: "840px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        color: "#FFFFFF",
        background: "var(--ink-deep)",
        borderRadius: "0 0 44px 44px",
        overflow: "hidden",
        marginBottom: bottom,
      }}
    >
      <Pic className="img kb" image={data.image} sizes="100vw" preload />
      <div style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--ink-deep) 22%, transparent)" }}></div>
      {withHeader && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 20 }}>
          <Header />
        </div>
      )}

      <div
        className="wrap"
        style={{ position: "relative", width: "100%", paddingTop: "180px", paddingBottom: "148px", display: "flex", flexDirection: "column", gap: "28px", alignItems: "flex-start" }}
      >
        <h1 className="display h-xl" style={{ maxWidth: "11ch" }}>
          <Lines text={data.title} />
        </h1>
        {data.text && (
          <p className="a1" style={{ maxWidth: "40ch", fontSize: "clamp(17px, 1.4vw, 20px)", color: "var(--on-dark-soft)" }}>
            {data.text}
          </p>
        )}
        <div className="a2" style={{ display: "flex", flexWrap: "wrap", gap: "14px 22px", alignItems: "center" }}>
          {data.buttonLabel && data.buttonHref && (
            <Link className="btn gold" href={data.buttonHref}>
              {data.buttonLabel}
              <i><ArrowIcon /></i>
            </Link>
          )}
          {data.linkLabel && data.linkHref && (
            <Link className="ul keep" href={data.linkHref} style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: "16px" }}>
              {data.linkLabel}
            </Link>
          )}
        </div>
      </div>

      {product && (
        <Link className="float-card hide-s a3" href={`/proizvod/${product.slug}`} style={{ right: "clamp(24px, 9vw, 150px)", top: "40%", color: "var(--ink)" }}>
          <span className="dot" style={{ position: "relative", margin: 0, background: "var(--ink)" }}></span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
            <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: "16px" }}>{product.name}</span>
            <span className="muted" style={{ fontSize: "14px" }}>{formatPrice(product.price)}</span>
          </span>
        </Link>
      )}
    </section>
  );
}

/* ---------- Prednosti ---------- */

type FeaturesData = { items: { icon: string; title: string; text: string }[] };

/** Odmah ispod glavnog banera kartica prelazi preko njegove fotografije. */
export function Features({ data, id, bottom, overlap }: BlockProps<FeaturesData> & { overlap: boolean }) {
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap" style={{ position: "relative", marginTop: overlap ? "-76px" : 0 }}>
        <div
          style={{
            background: "var(--paper)",
            borderRadius: "30px",
            boxShadow: "0 30px 60px -30px color-mix(in srgb, var(--ink) 35%, transparent)",
            padding: "clamp(24px, 3vw, 40px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))",
            gap: "28px 40px",
          }}
        >
          {data.items.map((item, index) => (
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }} key={index}>
              <span className="icon-c">{icons[item.icon]}</span>
              <div>
                <h3 className="display h-s">{item.title}</h3>
                <p className="muted" style={{ fontSize: "15.5px", marginTop: "4px" }}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Pločice sa slikama ---------- */

type TilesData = { heading: string; linkLabel: string; linkHref: string; items: { image: ImageValue; title: string; text: string; href: string }[] };

const tileLabel: CSSProperties = {
  position: "absolute",
  left: "14px",
  right: "14px",
  bottom: "14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  background: "color-mix(in srgb, var(--paper) 94%, transparent)",
  borderRadius: "18px",
  padding: "14px 14px 14px 20px",
  color: "var(--ink)",
};

export function Tiles({ data, id, bottom }: BlockProps<TilesData>) {
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap" style={sectionStack}>
        <div className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px 40px" }}>
          <h2 className="display h-l">{data.heading}</h2>
          {data.linkLabel && data.linkHref && (
            <Link className="more" href={data.linkHref}>
              {data.linkLabel} <i><ArrowSmallIcon /></i>
            </Link>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "20px" }}>
          {data.items.map((item, index) => (
            <Link className={`ph zoom rv${delay[index % 3]}`} href={item.href || "/kolekcija"} style={{ aspectRatio: "4 / 5" }} key={index}>
              <Pic image={item.image} sizes="(max-width: 700px) 100vw, 430px" />
              <span style={tileLabel}>
                <span>
                  <span className="display h-s" style={{ display: "block" }}>{item.title}</span>
                  <span className="muted" style={{ fontSize: "14px" }}>{item.text}</span>
                </span>
                <span className="icon-c" style={{ width: "44px", height: "44px" }}><ArrowSmallIcon /></span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Proizvodi ---------- */

type ProductsData = { heading: string; collection: string; limit: string; tabs: boolean; buttonLabel: string; buttonHref: string };

export function Products({ data, id, bottom }: BlockProps<ProductsData>) {
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <ProductsBlock
        heading={data.heading}
        collection={data.collection}
        limit={Number(data.limit)}
        tabs={data.tabs}
        button={data.buttonLabel && data.buttonHref ? { label: data.buttonLabel, href: data.buttonHref } : null}
      />
    </section>
  );
}

/* ---------- Tekst sa slikom ---------- */

type SplitData = { eyebrow: string; heading: string; text: string; linkLabel: string; linkHref: string; images: { image: ImageValue }[]; side: string };

/** Jedna fotografija stoji sama, dve su u paru, a tri se slažu u kolaž. */
function SplitMedia({ images }: { images: ImageValue[] }) {
  const small = "(max-width: 900px) 50vw, 300px";
  if (images.length === 1) {
    return (
      <div className="stack rv">
        <div className="ph zoom" style={{ aspectRatio: "5 / 4", boxShadow: "0 30px 60px -30px color-mix(in srgb, var(--ink) 35%, transparent)" }}>
          <Pic image={images[0]} sizes="(max-width: 900px) 100vw, 620px" />
        </div>
      </div>
    );
  }
  if (images.length === 2) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px", alignItems: "start" }}>
        <div className="ph zoom rv" style={{ aspectRatio: "3 / 4" }}>
          <Pic image={images[0]} sizes={small} />
        </div>
        <div className="ph zoom rv t1" style={{ aspectRatio: "3 / 4", marginTop: "56px" }}>
          <Pic image={images[1]} sizes={small} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="ph zoom rv" style={{ aspectRatio: "1" }}>
          <Pic image={images[0]} sizes={small} />
        </div>
        <div className="ph zoom rv t1" style={{ aspectRatio: "5 / 4" }}>
          <Pic image={images[1]} sizes={small} />
        </div>
      </div>
      <div className="ph zoom rv t2" style={{ aspectRatio: "3 / 5" }}>
        <Pic image={images[2]} sizes={small} />
      </div>
    </div>
  );
}

export function Split({ data, id, bottom }: BlockProps<SplitData>) {
  const images = data.images.map((item) => item.image).filter((image) => image.src);
  const media = images.length > 0 ? <SplitMedia images={images} key="media" /> : null;
  const text = (
    <div style={textStack} key="text">
      {data.eyebrow && <div className="over rv">{data.eyebrow}</div>}
      <h2 className="display h-l rv t1">{data.heading}</h2>
      {data.text && <p className="lead rv t2">{data.text}</p>}
      {data.linkLabel && data.linkHref && (
        <Link className="more rv t3" href={data.linkHref}>
          {data.linkLabel} <i><ArrowSmallIcon /></i>
        </Link>
      )}
    </div>
  );
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap split">{data.side === "right" ? [text, media] : [media, text]}</div>
    </section>
  );
}

/* ---------- Baner sa slikom ---------- */

type BannerData = { image: ImageValue; heading: string; text: string; buttonLabel: string; buttonHref: string; buttonStyle: string };

export function Banner({ data, id, bottom }: BlockProps<BannerData>) {
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap">
        <div className="ph rv" style={{ borderRadius: "36px", minHeight: "480px", display: "flex", alignItems: "flex-end", color: "#FFFFFF", background: "var(--ink-deep)" }}>
          <Pic image={data.image} sizes="(max-width: 1320px) 100vw, 1240px" />
          <div style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--ink-deep) 38%, transparent)" }}></div>
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
            {data.text ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "620px" }}>
                <h2 className="display h-l">{data.heading}</h2>
                <p style={{ color: "var(--on-dark-soft)", fontSize: "clamp(17px, 1.3vw, 19px)" }}>{data.text}</p>
              </div>
            ) : (
              <h2 className="display h-l" style={{ maxWidth: "14ch" }}>{data.heading}</h2>
            )}
            {data.buttonLabel && data.buttonHref && (
              <Link className={data.buttonStyle === "gold" ? "btn gold" : "btn light"} href={data.buttonHref}>
                {data.buttonLabel}
                <i><ArrowIcon /></i>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Utisci kupaca ---------- */

type TestimonialsData = { heading: string; items: { image: ImageValue; quote: string; name: string; city: string }[] };

export function Testimonials({ data, id, bottom }: BlockProps<TestimonialsData>) {
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap" style={sectionStack}>
        <h2 className="display h-l rv">{data.heading}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(290px, 100%), 1fr))", gap: "32px 20px" }}>
          {data.items.map((item, index) => (
            <figure className={`rev rv${delay[index % 3]}`} key={index}>
              <div className="ph" style={{ aspectRatio: "4 / 3" }}>
                <Pic image={item.image} sizes="(max-width: 700px) 100vw, 430px" />
              </div>
              <div className="rev-card">
                <blockquote style={{ margin: 0, fontSize: "16px" }}>“{item.quote}”</blockquote>
                <figcaption className="muted" style={{ fontSize: "14.5px" }}>
                  <strong style={{ color: "var(--ink)" }}>{item.name}</strong>
                  {item.city && `, ${item.city}`}
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Prijava na novosti ---------- */

type NewsletterData = { heading: string; text: string; image: ImageValue };

export function Newsletter({ data, id, bottom }: BlockProps<NewsletterData>) {
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap">
        <div
          className="dark rv"
          style={{
            borderRadius: "36px",
            padding: "10px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))",
            gap: "10px",
            alignItems: "stretch",
          }}
        >
          <div style={{ padding: "clamp(24px, 4vw, 56px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: "26px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <h2 className="display h-l">{data.heading}</h2>
              {data.text && <p className="lead">{data.text}</p>}
            </div>
            <NewsletterForm />
          </div>
          {data.image.src && (
            <div className="ph zoom" style={{ borderRadius: "28px", minHeight: "340px" }}>
              <Pic image={data.image} sizes="(max-width: 900px) 100vw, 640px" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Naslov stranice ---------- */

type IntroData = { title: string; text: string };

export function Intro({ data, id }: BlockProps<IntroData>) {
  return (
    <section id={id} style={{ padding: "clamp(48px, 6vw, 96px) 0 clamp(30px, 4vw, 52px)" }}>
      <div className="wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "20px 64px" }}>
        <h1 className="display h-xl" style={{ maxWidth: "14ch" }}>
          <Lines text={data.title} />
        </h1>
        {data.text && (
          <p className="lead a1" style={{ maxWidth: "40ch", paddingBottom: "10px" }}>{data.text}</p>
        )}
      </div>
    </section>
  );
}

/* ---------- Široka fotografija ---------- */

export function WidePhoto({ data, id, bottom }: BlockProps<{ image: ImageValue }>) {
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap">
        <div className="ph" style={{ borderRadius: "36px", aspectRatio: "16 / 8", minHeight: "280px" }}>
          <Pic className="img kb" image={data.image} sizes="(max-width: 1320px) 100vw, 1240px" preload />
        </div>
      </div>
    </section>
  );
}

/* ---------- Tekst ---------- */

export function TextBlock({ data, id, bottom }: BlockProps<{ heading: string; body: string }>) {
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: "clamp(20px, 5vw, 96px)" }}>
        <h2 className="display h-l rv">{data.heading}</h2>
        <div className="rv t1" style={{ display: "flex", flexDirection: "column", gap: "20px", color: "var(--soft)", maxWidth: "58ch" }}>
          {paragraphs(data.body).map((paragraph, index) => (
            <p style={{ whiteSpace: "pre-line" }} key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Kartice ---------- */

type CardsData = { items: { icon: string; title: string; text: string; dark: boolean }[] };

export function Cards({ data, id, bottom }: BlockProps<CardsData>) {
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "20px" }}>
        {data.items.map((item, index) => (
          <div
            className={`panel rv${delay[index % 4]}`}
            style={{ display: "flex", flexDirection: "column", gap: "14px", ...(item.dark ? { background: "var(--ink)", color: "var(--on-dark)" } : {}) }}
            key={index}
          >
            <span className="icon-c" style={item.dark ? { background: "var(--gold)", color: "var(--on-gold)" } : { background: "var(--paper)" }}>
              {icons[item.icon]}
            </span>
            <h3 className="display h-m" style={{ marginTop: "12px" }}>{item.title}</h3>
            <p className={item.dark ? undefined : "muted"} style={item.dark ? { color: "var(--on-dark-mute)" } : undefined}>{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Koraci ---------- */

type StepsData = { heading: string; images: { image: ImageValue }[]; items: { title: string; text: string }[] };

const line = "1px solid var(--line)";

export function Steps({ data, id, bottom }: BlockProps<StepsData>) {
  const images = data.images.map((item) => item.image).filter((image) => image.src);
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap split">
        {images.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${images.length}, minmax(0, 1fr))`, gap: "16px", alignItems: "start" }}>
            {images.map((image, index) => (
              <div className={`ph zoom rv${delay[index]}`} style={{ aspectRatio: "3 / 4", marginTop: index === 1 ? "56px" : 0 }} key={index}>
                <Pic image={image} sizes="(max-width: 900px) 50vw, 300px" />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
          <h2 className="display h-l rv">{data.heading}</h2>
          <ol className="rv t1" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
            {data.items.map((item, index) => (
              <li
                style={{ display: "flex", gap: "20px", padding: "22px 0", borderTop: line, ...(index === data.items.length - 1 ? { borderBottom: line } : {}) }}
                key={index}
              >
                <span className="display h-s" style={{ color: "var(--gold-d)", minWidth: "28px" }}>{index + 1}</span>
                <div>
                  <div className="display h-s">{item.title}</div>
                  <p className="muted" style={{ marginTop: "4px" }}>{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------- Pitanja i odgovori ---------- */

type FaqData = { items: { topic: string; question: string; answer: string }[] };

export function Faq({ data, id, bottom, query }: BlockProps<FaqData> & { query: Query }) {
  // Link sa ?tema=… otvara pitanja sa izabranom temom.
  const topic = data.items.find((item) => item.topic === query.tema)?.topic ?? "";
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <FaqList items={data.items} initialTopic={topic} key={topic} />
    </section>
  );
}

/* ---------- Poziv na tamnoj traci ---------- */

type CtaData = { heading: string; text: string; buttonLabel: string; buttonHref: string };

export function Cta({ data, id, bottom }: BlockProps<CtaData>) {
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
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
            <h2 className="display h-l">{data.heading}</h2>
            {data.text && <p className="lead">{data.text}</p>}
          </div>
          {data.buttonLabel && data.buttonHref && (
            <Link className="btn gold" href={data.buttonHref}>
              {data.buttonLabel}
              <i><ArrowIcon /></i>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Kontakt ---------- */

type ContactData = { hours: { days: string; time: string }[] };

// Linkovi „Poručite uzorke" i „Zakažite savet" otvaraju formu sa izabranom temom.
const TOPIC_LINKS: Record<string, ContactTopic> = {
  uzorci: "Uzorci tkanina",
  savet: "Savet dizajnera",
};

const iconStroke = { fill: "none", stroke: "currentColor", strokeWidth: "1.600", strokeLinecap: "round", strokeLinejoin: "round" } as const;

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
      <span className="icon-c" style={{ background: "var(--paper)" }}>{icon}</span>
      <div>
        <div className="muted" style={{ fontSize: "14.5px" }}>{label}</div>
        {children}
      </div>
    </div>
  );
}

/** Email, telefon i adresa su iz Podešavanja → Prodavnica; red bez podatka se ne prikazuje. */
export async function Contact({ data, id, bottom, query, store }: BlockProps<ContactData> & { query: Query; store: StoreSettings }) {
  const t = await getShopT();
  const topic = TOPIC_LINKS[query.tema ?? ""] ?? CONTACT_TOPICS[0];
  return (
    <section id={id} style={{ paddingBottom: bottom }}>
      <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "stretch" }}>
        <ContactForm initialTopic={topic} key={topic} />

        <div className="panel a3" style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: "22px" }}>
          {store.email && (
            <InfoRow
              label={t("Email")}
              icon={
                <svg width="20" height="16" viewBox="0 0 20 16" {...iconStroke}>
                  <rect x="1" y="1" width="18" height="14" rx="3"></rect>
                  <path d="M2 3l8 6 8-6"></path>
                </svg>
              }
            >
              <a className="display h-s ul" href={`mailto:${store.email}`}>{store.email}</a>
            </InfoRow>
          )}
          {store.phone && (
            <InfoRow
              label={t("Telefon")}
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" {...iconStroke}>
                  <path d="M4 1h4l2 5-2.500 1.500a11 11 0 005 5L14 10l5 2v4a2 2 0 01-2 2A16 16 0 012 3a2 2 0 012-2z"></path>
                </svg>
              }
            >
              <a className="display h-s ul" href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}>{store.phone}</a>
            </InfoRow>
          )}
          {store.address && (
            <InfoRow
              label={t("Adresa")}
              icon={
                <svg width="18" height="22" viewBox="0 0 18 22" {...iconStroke}>
                  <path d="M9 21s8-7 8-12.500A8 8 0 001 8.500C1 14 9 21 9 21z"></path>
                  <circle cx="9" cy="8.500" r="3"></circle>
                </svg>
              }
            >
              <div className="display h-s">{store.address}</div>
            </InfoRow>
          )}
          {data.hours.length > 0 && (
            <div style={{ background: "var(--paper)", borderRadius: "20px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
              <div className="lab">{t("Radno vreme")}</div>
              {data.hours.map((row, index) => (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }} key={index}>
                  <span>{row.days}</span>
                  <span>{row.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
