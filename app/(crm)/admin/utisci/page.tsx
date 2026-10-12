import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getProducts, getSettings } from "@/lib/content";
import { getAllReviews, type ReviewStatus } from "@/lib/reviews";
import { deleteReviewAction, reviewStatusAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { dateFormats } from "../order-ui";
import { cardClass, PageHeader, quietButtonClass, rowClass } from "../ui";

const statusLabels: Record<ReviewStatus, string> = { pending: "čeka odobrenje", approved: "objavljen", rejected: "odbijen" };
const badge = "rounded-full px-[12px] font-display text-[12.5px] leading-[26px] font-bold";

export default async function ReviewsPage() {
  const t = await getPanelT();
  await requireAdmin("orders");
  const [reviews, products, settings] = await Promise.all([getAllReviews(), getProducts(), getSettings()]);
  const { orderDate } = dateFormats(settings.store);
  const waiting = reviews.filter((review) => review.status === "pending").length;

  return (
    <>
      <PageHeader
        title={t("Utisci")}
        hint={t("Utiske pišu prijavljeni kupci na stranici proizvoda. Na sajtu se vide tek kada ih odobrite; izmenjen utisak ponovo čeka odobrenje.")}
      />
      <div className={cardClass}>
        <p className="mb-[8px] text-[15px] text-muted">
          {waiting > 0 ? t("Čeka odobrenje: {a}.", { a: waiting }) : t("Nijedan utisak ne čeka odobrenje.")}
        </p>
        {reviews.map((review) => {
          const product = products.find((candidate) => candidate.slug === review.productSlug);
          return (
            <div key={review.id} className={`${rowClass} items-start`}>
              <div className="min-w-0 grow basis-[320px] text-[15px]">
                <div className="flex flex-wrap items-center gap-[8px]">
                  <span className="font-display font-bold">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                  <span className="font-medium">{review.name}</span>
                  <span className={`${badge} ${review.status === "pending" ? "bg-gold text-ink" : review.status === "approved" ? "bg-band text-ink" : "bg-band text-muted line-through"}`}>
                    {t(statusLabels[review.status])}
                  </span>
                  {review.verified && <span className="text-[13px] text-muted">{t("kupio/la proizvod")}</span>}
                </div>
                <div className="text-[13px] text-muted">
                  {orderDate(review.createdAt)} ·{" "}
                  {product ? (
                    <Link href={`/proizvod/${product.slug}`} target="_blank" className="underline">
                      {product.name}
                    </Link>
                  ) : (
                    `${review.productSlug} (obrisan proizvod)`
                  )}
                </div>
                <p className="mt-[6px] whitespace-pre-wrap">{review.body}</p>
              </div>
              <div className="flex flex-wrap gap-[8px]">
                {review.status !== "approved" && (
                  <form action={reviewStatusAction}>
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value="approved" />
                    <button type="submit" className={quietButtonClass}>
                      {t("Odobri")}
                    </button>
                  </form>
                )}
                {review.status !== "rejected" && (
                  <form action={reviewStatusAction}>
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button type="submit" className={quietButtonClass}>
                      {review.status === "approved" ? t("Skloni") : t("Odbij")}
                    </button>
                  </form>
                )}
                <form action={deleteReviewAction}>
                  <input type="hidden" name="id" value={review.id} />
                  <ConfirmButton question={t("Obrisati ovaj utisak?")} className={quietButtonClass}>
                    {t("Obriši")}
                  </ConfirmButton>
                </form>
              </div>
            </div>
          );
        })}
        {reviews.length === 0 && <p className="text-[15px] text-muted">{t("Još nema utisaka.")}</p>}
      </div>
    </>
  );
}
