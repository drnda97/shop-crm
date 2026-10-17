"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/client";

type ConfirmDialogProps = {
  open: boolean;
  /** Pitanje, npr. „Obrisati nalog?". */
  question: string;
  /** Objašnjenje ispod pitanja. */
  detail?: string;
  /** Natpis dugmeta za potvrdu, već preveden. */
  confirmLabel: string;
  onConfirm: () => void;
  /** Esc, „Odustani" i klik pored prozora. */
  onCancel: () => void;
};

/**
 * Prozor za potvrdu u stilu prodavnice, umesto prozora pregledača. Fokus je na „Odustani",
 * da Enter ne potvrdi brisanje slučajno.
 */
export function ConfirmDialog({ open, question, detail, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="ask"
      aria-labelledby="ask-title"
      aria-describedby="ask-detail"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onCancel();
      }}
    >
      {open && (
        <>
          <h2 id="ask-title">{question}</h2>
          <div id="ask-detail">
            {detail && <p>{detail}</p>}
            <p className="ask-warn">{t("Ovo ne možete vratiti.")}</p>
          </div>
          <div className="row">
            <button className="btn ghost" type="button" autoFocus onClick={onCancel}>
              {t("Odustani")}
            </button>
            <button className="btn danger" type="button" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
