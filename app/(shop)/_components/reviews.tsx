"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { reviewAction } from "../actions";
import { ERROR_STYLE } from "./field";

export type ShownReview = { id: number; name: string; rating: number; body: string; date: string; verified: boolean };

const STAR = "M10 1.500l2.600 5.400 5.900.800-4.300 4.100 1.100 5.900L10 14.900l-5.300 2.800 1.100-5.900L1.500 7.700l5.900-.800z";

/** Ocena zvezdicama; `label` je čita čitač ekrana. */
export function Stars({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <span role="img" aria-label={`Ocena ${rating} od 5`} style={{ display: "inline-flex", gap: "2px", color: "var(--gold)" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width={size} height={size} viewBox="0 0 20 19" fill={rating >= star - 0.25 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.400" strokeLinejoin="round" aria-hidden="true">
          <path d={STAR}></path>
        </svg>
      ))}
    </span>
  );
}

type ReviewsProps = {
  slug: string;
  reviews: ShownReview[];
  summary: { average: number; count: number } | null;
  /** Utisak može da ostavi prijavljen kupac. */
  loggedIn: boolean;
};

/** Utisci na stranici proizvoda i forma za nov utisak. */
export function Reviews({ slug, reviews, summary, loggedIn }: ReviewsProps) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [state, setState] = useState<{ sent: boolean; error: string }>({ sent: false, error: "" });
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await reviewAction({ slug, rating, text });
      setState(result.ok ? { sent: true, error: "" } : { sent: false, error: result.error });
    });
  }

  return (
    <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: "clamp(28px, 5vw, 88px)", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <h2 className="display h-l rv">Utisci kupaca</h2>
        {summary ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <Stars rating={summary.average} size={22} />
            <span className="display h-s">{summary.average.toFixed(1).replace(".", ",")}</span>
            <span className="muted">({summary.count})</span>
          </div>
        ) : (
          <p className="muted">Još nema utisaka za ovaj proizvod.</p>
        )}

        {state.sent ? (
          <p role="status" className="panel" style={{ padding: "18px 22px", borderRadius: "20px" }}>
            Hvala. Utisak će biti objavljen kada ga pregledamo.
          </p>
        ) : loggedIn ? (
          <form onSubmit={submit} noValidate className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "22px" }}>
            <div className="lab">Vaša ocena</div>
            <div role="radiogroup" aria-label="Ocena" style={{ display: "flex", gap: "4px" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} od 5`}
                  onClick={() => setRating(star)}
                  style={{ width: "44px", height: "44px", background: "none", border: 0, cursor: "pointer", color: "var(--gold)", padding: 0 }}
                >
                  <svg width="28" height="27" viewBox="0 0 20 19" fill={rating >= star ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.400" strokeLinejoin="round" aria-hidden="true">
                    <path d={STAR}></path>
                  </svg>
                </button>
              ))}
            </div>
            <div className="f">
              <label htmlFor="review-text">Vaš utisak</label>
              <textarea id="review-text" maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} style={{ background: "var(--paper)" }}></textarea>
            </div>
            {state.error && <p role="alert" style={ERROR_STYLE}>{state.error}</p>}
            <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>Pošalji utisak</button>
          </form>
        ) : (
          <p className="muted">
            <Link className="ul keep" href="/nalog">Prijavite se</Link> da biste ostavili utisak.
          </p>
        )}
      </div>

      <div style={{ flex: "2 1 460px", minWidth: 0, display: "flex", flexDirection: "column" }}>
        {reviews.map((review) => (
          <article key={review.id} style={{ borderTop: "1px solid var(--line)", padding: "20px 0", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px" }}>
              <Stars rating={review.rating} />
              <strong>{review.name}</strong>
              {review.verified && <span className="muted" style={{ fontSize: "14px" }}>· kupio/la ovaj proizvod</span>}
              <span className="muted" style={{ fontSize: "14px", marginLeft: "auto" }}>{review.date}</span>
            </div>
            <p style={{ whiteSpace: "pre-line" }}>{review.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
