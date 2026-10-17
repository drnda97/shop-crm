"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Pitanje pre radnje koja se ne može vratiti (brisanje, slanje svima), u prozoru panela umesto
 * prozora pregledača. `ask` vraća true kada je korisnik potvrdio; Esc, „Odustani" i klik pored
 * prozora vraćaju false.
 */

export type ConfirmOptions = {
  /** Pitanje, npr. „Obrisati proizvod „Fotelja"?". Deo posle prvog upitnika je objašnjenje ispod. */
  question: string;
  /** Natpis dugmeta za potvrdu, npr. „Obriši"; već preveden. */
  confirmLabel: string;
  /** „danger" (podrazumevano): brisanje — crveno dugme i napomena da se ne može vratiti. */
  tone?: "danger" | "default";
};

type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm radi samo unutar ConfirmProvider (app/(crm)/layout.tsx).");
  return ask;
}

/** „Obrisati X? Kodovi ostaju da važe." → naslov „Obrisati X?" i tekst „Kodovi ostaju da važe.". */
function split(question: string): [string, string] {
  const at = question.indexOf("?");
  return at === -1 || at === question.length - 1 ? [question, ""] : [question.slice(0, at + 1), question.slice(at + 1).trim()];
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState<(ConfirmOptions & { resolve: (yes: boolean) => void }) | null>(null);

  const ask = useCallback<Ask>((options) => new Promise((resolve) => setCurrent({ ...options, resolve })), []);

  useEffect(() => {
    if (current && !dialog.current?.open) dialog.current?.showModal();
  }, [current]);

  function finish(yes: boolean) {
    current?.resolve(yes);
    setCurrent(null);
    dialog.current?.close();
  }

  const [title, detail] = current ? split(current.question) : ["", ""];
  const danger = (current?.tone ?? "danger") === "danger";

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <dialog
        ref={dialog}
        aria-labelledby="confirm-title"
        aria-describedby={detail || danger ? "confirm-detail" : undefined}
        // Esc zatvara prozor kao „Odustani".
        onCancel={(event) => {
          event.preventDefault();
          finish(false);
        }}
        onClick={(event) => {
          if (event.target === dialog.current) finish(false);
        }}
        className="m-auto w-[min(460px,calc(100vw-32px))] rounded-[26px] bg-white p-0 text-ink shadow-lift backdrop:bg-ink/55 backdrop:backdrop-blur-[2px] open:animate-pop"
      >
        {current && (
          <div className="flex flex-col gap-[14px] p-[26px]">
            <h2 id="confirm-title" className="text-[20px] leading-[1.25]">
              {title}
            </h2>
            {(detail || danger) && (
              <div id="confirm-detail" className="flex flex-col gap-[8px] text-[15px] text-muted">
                {detail && <p>{detail}</p>}
                {danger && (
                  <p className="flex items-center gap-[8px] font-medium text-danger">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="shrink-0">
                      <path d="M10 3.5 17.5 16.5h-15L10 3.5Z" strokeLinejoin="round" />
                      <path d="M10 8.5v3.5M10 14.2v.1" strokeLinecap="round" />
                    </svg>
                    {t("Ovo ne možete vratiti.")}
                  </p>
                )}
              </div>
            )}
            <div className="mt-[8px] flex flex-wrap justify-end gap-[10px]">
              {/* Kod brisanja je fokus na „Odustani", da Enter ne obriše slučajno. */}
              <button
                type="button"
                autoFocus={danger}
                onClick={() => finish(false)}
                className="inline-flex min-h-[46px] cursor-pointer items-center justify-center rounded-full px-[22px] font-display text-[14px] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-[background-color,box-shadow] duration-300 hover:bg-band hover:shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
              >
                {t("Odustani")}
              </button>
              <button
                type="button"
                autoFocus={!danger}
                onClick={() => finish(true)}
                className={`inline-flex min-h-[46px] cursor-pointer items-center justify-center rounded-full px-[24px] font-display text-[14px] font-bold text-paper transition-[background-color,box-shadow] duration-300 hover:shadow-lift ${
                  danger ? "bg-danger hover:bg-danger-2" : "bg-ink hover:bg-ink-2"
                }`}
              >
                {current.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}
