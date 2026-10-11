import type { CSSProperties, InputHTMLAttributes } from "react";

/** Poruka o grešci ispod polja. */
export const ERROR_STYLE: CSSProperties = { fontSize: "14px", fontWeight: 600, color: "var(--gold-d)" };

/** Polje forme (.f) sa oznakom i porukom o grešci. */
export function Field({
  id,
  label,
  error,
  ...input
}: { id: string; label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="f">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} {...input} />
      {error && (
        <span role="alert" style={ERROR_STYLE}>
          {error}
        </span>
      )}
    </div>
  );
}
