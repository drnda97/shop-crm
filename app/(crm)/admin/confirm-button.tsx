"use client";

import type { ReactNode } from "react";

type ConfirmButtonProps = {
  /** Pitanje koje se postavlja pre slanja forme. */
  question: string;
  className: string;
  children: ReactNode;
};

/** Dugme za slanje forme koje prvo traži potvrdu — za brisanje. */
export function ConfirmButton({ question, className, children }: ConfirmButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(question)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
