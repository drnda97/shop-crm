import Link from "next/link";
import type { ReactNode } from "react";
import { getShopPath, getShopT } from "@/lib/i18n/server";
import type { Block, Inline } from "@/lib/rich-text";
import type { BlogCard } from "@/lib/storefront/blog";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { DS_STYLE, Photo } from "../components/ui";

/** Blog: spisak članaka (/blog) i članak (/blog/{adresa}). */

type Path = (href: string) => string;

function Meta({ date, author }: { date: string; author: string }) {
  return (
    <div className="muted" style={{ fontSize: "14.5px" }}>
      {date}
      {author ? ` · ${author}` : ""}
    </div>
  );
}

function PostCard({ post, date, to, wide }: { post: BlogCard; date: string; to: Path; wide?: boolean }) {
  const href = to(`/blog/${post.slug}`);
  return (
    <article className="card post-card" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <div className={wide ? "post-wide" : undefined}>
        {post.image && (
          <Link className="ph card-media post-media" href={href} aria-hidden="true" tabIndex={-1}>
            <Photo src={post.image} alt={post.imageAlt} sizes={wide ? "(max-width: 900px) 100vw, 760px" : "(max-width: 700px) 100vw, 420px"} preload={wide} />
          </Link>
        )}
        <div className="card-body" style={{ gap: "10px", padding: wide ? "clamp(16px, 2.4vw, 32px)" : undefined }}>
          <Meta date={date} author={post.author} />
          <h2 className={`display ${wide ? "h-m" : "h-s"}`}>
            <Link href={href} style={{ textDecoration: "none" }}>{post.title}</Link>
          </h2>
          {post.excerpt && <p className="muted" style={{ fontSize: "16px", lineHeight: 1.6 }}>{post.excerpt}</p>}
        </div>
      </div>
    </article>
  );
}

export type BlogPageProps = {
  posts: (BlogCard & { date: string })[];
  /** Sve oznake, za filter; `tag` je izabrana ili "". */
  tags: string[];
  tag: string;
  page: number;
  pages: number;
};

export async function BlogPage({ posts, tags, tag, page, pages }: BlogPageProps) {
  const [t, to] = await Promise.all([getShopT(), getShopPath()]);
  const listPath = (wantedTag: string, wantedPage = 1) => {
    const query = [wantedTag ? `oznaka=${encodeURIComponent(wantedTag)}` : "", wantedPage > 1 ? `strana=${wantedPage}` : ""].filter(Boolean).join("&");
    return to(`/blog${query ? `?${query}` : ""}`);
  };
  return (
    <div className="ds" style={DS_STYLE}>
      <Header />
      <section style={{ padding: "clamp(40px, 6vw, 88px) 0 clamp(72px, 9vw, 136px)" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(24px, 3vw, 40px)" }}>
          <h1 className="display h-l a1">{t("Blog")}</h1>

          {tags.length > 0 && (
            <div className="a2" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <Link className={`chip post-chip${tag === "" ? " on" : ""}`} href={listPath("")}>{t("Sve")}</Link>
              {tags.map((item) => (
                <Link key={item} className={`chip post-chip${item === tag ? " on" : ""}`} href={listPath(item)}>{item}</Link>
              ))}
            </div>
          )}

          {posts.length === 0 ? (
            <p className="lead">{tag ? t("Nema članaka sa ovom oznakom.") : t("Još nema članaka.")}</p>
          ) : (
            <div className="post-grid a3">
              {posts.map((post, index) => (
                // Najnoviji članak na prvoj strani zauzima ceo red.
                <PostCard key={post.slug} post={post} date={post.date} to={to} wide={index === 0 && page === 1 && Boolean(post.image)} />
              ))}
            </div>
          )}

          {pages > 1 && (
            <nav aria-label={t("Strane")} style={{ display: "flex", gap: "12px", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              {page > 1 && <Link className="btn ghost" href={listPath(tag, page - 1)}>{t("← Noviji")}</Link>}
              <span className="muted">{t("Strana {a} od {b}", { a: page, b: pages })}</span>
              {page < pages && <Link className="btn ghost" href={listPath(tag, page + 1)}>{t("Stariji →")}</Link>}
            </nav>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}

function inline(nodes: Inline[], to: Path): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.kind === "text") return node.text;
    if (node.kind === "bold") return <strong key={index}>{inline(node.children, to)}</strong>;
    if (node.kind === "italic") return <em key={index}>{inline(node.children, to)}</em>;
    const outside = /^https?:\/\//i.test(node.href);
    return outside ? (
      <a key={index} href={node.href} target="_blank" rel="noopener noreferrer">{inline(node.children, to)}</a>
    ) : (
      <Link key={index} href={to(node.href)}>{inline(node.children, to)}</Link>
    );
  });
}

function BlockView({ block, to }: { block: Block; to: Path }) {
  if (block.kind === "heading") return block.level === 2 ? <h2 className="display h-m">{inline(block.children, to)}</h2> : <h3 className="display h-s">{inline(block.children, to)}</h3>;
  if (block.kind === "quote") return <blockquote>{inline(block.children, to)}</blockquote>;
  if (block.kind === "image") {
    return (
      <figure className="ph article-img">
        {/* Slika iz teksta nema poznate mere, pa ide kao obična slika u punoj širini teksta. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={block.src} alt={block.alt} loading="lazy" />
      </figure>
    );
  }
  if (block.kind === "list") {
    const items = block.items.map((item, index) => <li key={index}>{inline(item, to)}</li>);
    return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
  }
  return <p>{inline(block.children, to)}</p>;
}

export type ArticlePageProps = {
  post: { title: string; image: string; imageAlt: string; author: string; tags: string[]; date: string };
  blocks: Block[];
  /** Drugi noviji članci, ispod teksta. */
  more: (BlogCard & { date: string })[];
  /** Podaci za pretraživače (schema.org), ili null. */
  structured: object | null;
};

export async function ArticlePage({ post, blocks, more, structured }: ArticlePageProps) {
  const [t, to] = await Promise.all([getShopT(), getShopPath()]);
  return (
    <div className="ds" style={DS_STYLE}>
      <Header />
      {structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />}
      <article style={{ padding: "clamp(32px, 5vw, 72px) 0 clamp(56px, 7vw, 104px)" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "clamp(22px, 3vw, 36px)" }}>
          <header className="article-head a1">
            <Link className="ul keep" href={to("/blog")} style={{ alignSelf: "flex-start", fontSize: "15px" }}>{t("← Blog")}</Link>
            <h1 className="display h-l">{post.title}</h1>
            <Meta date={post.date} author={post.author} />
          </header>
          {post.image && (
            <div className="ph a2" style={{ aspectRatio: "16 / 8", borderRadius: "32px" }}>
              <Photo src={post.image} alt={post.imageAlt} sizes="(max-width: 1320px) 100vw, 1240px" preload />
            </div>
          )}
          <div className="article a3">
            {blocks.map((block, index) => (
              <BlockView key={index} block={block} to={to} />
            ))}
            {post.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                {post.tags.map((tag) => (
                  <Link key={tag} className="chip post-chip" href={to(`/blog?oznaka=${encodeURIComponent(tag)}`)}>{tag}</Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </article>

      {more.length > 0 && (
        <section style={{ paddingBottom: "clamp(72px, 9vw, 136px)" }}>
          <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <h2 className="display h-m">{t("Još sa bloga")}</h2>
            <div className="post-grid">
              {more.map((item) => (
                <PostCard key={item.slug} post={item} date={item.date} to={to} />
              ))}
            </div>
          </div>
        </section>
      )}
      <Footer />
    </div>
  );
}
