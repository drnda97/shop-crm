import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { cache } from "react";
import { getDb } from "@/lib/db";

/**
 * Utisci o proizvodima. Piše ih prijavljen kupac, jedan po proizvodu; na sajtu se vide tek
 * kada ih prodavac odobri u panelu (Utisci). Samo za server.
 */

export type ReviewStatus = "pending" | "approved" | "rejected";

export type Review = {
  id: number;
  productSlug: string;
  name: string;
  /** Ocena od 1 do 5. */
  rating: number;
  body: string;
  createdAt: string;
  status: ReviewStatus;
  /** Kupac je ovaj proizvod zaista poručio sa svog naloga. */
  verified: boolean;
};

function toReview(row: RowDataPacket): Review {
  return {
    id: row.id,
    productSlug: row.product_slug,
    name: row.name,
    rating: row.rating,
    body: row.body,
    createdAt: (row.created_at as Date).toISOString(),
    status: row.status,
    verified: row.verified === 1,
  };
}

/** Upisuje utisak, ili menja postojeći istog kupca za isti proizvod; izmenjen utisak ponovo čeka odobrenje. */
export async function saveReview(input: { productSlug: string; userId: number; name: string; rating: number; body: string; verified: boolean }) {
  await (
    await getDb()
  ).query(
    `INSERT INTO reviews (product_slug, user_id, name, rating, body, created_at, status, verified)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), rating = VALUES(rating), body = VALUES(body),
       created_at = VALUES(created_at), status = 'pending', verified = VALUES(verified)`,
    [input.productSlug, input.userId, input.name, input.rating, input.body, new Date(), input.verified],
  );
}

/** Odobreni utisci jednog proizvoda, najnoviji prvi. */
export const getProductReviews = cache(async (slug: string): Promise<Review[]> => {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT * FROM reviews WHERE product_slug = ? AND status = 'approved' ORDER BY id DESC", [slug]);
  return rows.map(toReview);
});

/** Svi utisci za panel: oni koji čekaju prvi, pa najnoviji. */
export async function getAllReviews(): Promise<Review[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT * FROM reviews ORDER BY status = 'pending' DESC, id DESC LIMIT 500");
  return rows.map(toReview);
}

export async function countPendingReviews(): Promise<number> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT COUNT(*) AS waiting FROM reviews WHERE status = 'pending'");
  return Number(rows[0].waiting);
}

export async function setReviewStatus(id: number, status: ReviewStatus) {
  await (await getDb()).query("UPDATE reviews SET status = ? WHERE id = ?", [status, id]);
}

export async function deleteReview(id: number): Promise<boolean> {
  const [changed] = await (await getDb()).query<ResultSetHeader>("DELETE FROM reviews WHERE id = ?", [id]);
  return changed.affectedRows > 0;
}

/** Prosečna ocena na jednu decimalu i broj utisaka; null kada ih nema. */
export function ratingSummary(reviews: { rating: number }[]): { average: number; count: number } | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}
