import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getAllPosts, isVisible } from "@/lib/blog";
import { getSettings } from "@/lib/content";
import { getPanelT } from "@/lib/i18n/server";
import { deletePostAction } from "../blog-actions";
import { ConfirmButton } from "../confirm-button";
import { buttonClass, cardClass, PageHeader, Pager, paginate, quietButtonClass, rowClass, Thumb } from "../ui";

type BlogPageProps = { searchParams: Promise<{ greska?: string; strana?: string }> };

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const t = await getPanelT();
  await requireAdmin("content");
  const [{ greska, strana }, posts, settings] = await Promise.all([searchParams, getAllPosts(), getSettings()]);
  const { shown, page, pages } = paginate(posts, strana);
  const date = new Intl.DateTimeFormat(settings.store.locale, { dateStyle: "medium", timeZone: settings.store.timeZone });
  const now = new Date();

  return (
    <>
      <PageHeader
        title={t("Blog")}
        hint={t("Članci na adresi /blog: saveti, novosti, priče o proizvodima. Link ka blogu dodajete u meni u delu Izgled sajta.")}
        error={greska}
        action={
          <Link href={`${ADMIN_PATH}/blog/novi`} className={buttonClass}>
            {t("Novi članak")}
          </Link>
        }
      />
      <div className={cardClass}>
        {shown.map((post) => (
          <div key={post.id} className={rowClass}>
            <Thumb src={post.image || undefined} alt="" />
            <div className="min-w-[200px] grow">
              <div className="text-[17px]">{post.title}</div>
              <div className="text-[14px] text-muted">
                {post.status === "draft"
                  ? t("Nacrt")
                  : isVisible(post, now)
                    ? `${t("Objavljen")} ${date.format(new Date(post.publishedAt))}`
                    : `${t("Zakazan za")} ${date.format(new Date(post.publishedAt))}`}
                {post.author ? ` · ${post.author}` : ""}
                {post.tags.length > 0 ? ` · ${post.tags.join(", ")}` : ""}
              </div>
            </div>
            <Link href={`${ADMIN_PATH}/blog/${post.id}`} className={quietButtonClass}>
              {t("Izmeni")}
            </Link>
            <form action={deletePostAction}>
              <input type="hidden" name="id" value={post.id} />
              <ConfirmButton question={t("Obrisati članak „{a}\"?", { a: post.title })} className={quietButtonClass}>
                {t("Obriši")}
              </ConfirmButton>
            </form>
          </div>
        ))}
        {posts.length === 0 && <p className="text-[15px] text-muted">{t("Još nema članaka.")}</p>}
      </div>

      {posts.length > 0 && (
        <Pager path={`${ADMIN_PATH}/blog`} page={page} pages={pages} summary={t("Članaka: {a}", { a: posts.length })} />
      )}
    </>
  );
}
