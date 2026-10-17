"use client";

import { useRef, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { useConfirm } from "./confirm";

type ConfirmButtonProps = {
  /** Pitanje u prozoru za potvrdu; deo posle prvog upitnika je objašnjenje ispod njega. */
  question: string;
  className: string;
  children: ReactNode;
  /** Natpis dugmeta za potvrdu; podrazumevano isti kao natpis ovog dugmeta. */
  confirmLabel?: string;
  /** „default" za radnju koja nije brisanje (npr. slanje svima): dugme za potvrdu nije crveno. */
  tone?: "danger" | "default";
};

/** Dugme za slanje forme koje prvo pita u prozoru panela (confirm.tsx) — za brisanje i slične radnje. */
export function ConfirmButton({ question, className, children, confirmLabel, tone = "danger" }: ConfirmButtonProps) {
  const t = useT();
  const ask = useConfirm();
  const button = useRef<HTMLButtonElement>(null);
  // Posle potvrde forma se šalje ponovo istim dugmetom; ovaj put bez pitanja.
  const confirmed = useRef(false);

  return (
    <button
      ref={button}
      type="submit"
      className={className}
      onClick={async (event) => {
        if (confirmed.current) {
          confirmed.current = false;
          return;
        }
        // Nepopunjena obavezna polja: pregledač ih prvo pokaže, pa se tek ispravna forma potvrđuje.
        if (button.current?.form && !button.current.form.checkValidity()) return;
        event.preventDefault();
        const label = confirmLabel ?? (typeof children === "string" ? children : t("Potvrdi"));
        if (!(await ask({ question, confirmLabel: label, tone }))) return;
        confirmed.current = true;
        button.current?.click();
      }}
    >
      {children}
    </button>
  );
}
