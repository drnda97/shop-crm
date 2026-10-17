import type { ReactNode } from "react";

/** Zajednički stilovi i sitni delovi admin panela. */

export const inputClass =
  "min-h-[50px] w-full rounded-[16px] border-[1.5px] border-line bg-white px-[16px] py-[10px] font-sans text-[16px] font-medium text-ink transition-colors duration-300 hover:border-line-strong focus:border-ink focus:outline-0";
export const labelClass = "flex flex-col gap-[6px] font-display text-[14px] font-semibold text-ink";
/** Glavno dugme: tamna pilula. */
export const buttonClass =
  "inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-full bg-ink px-[26px] font-display text-[15px] font-bold whitespace-nowrap text-paper transition-[background-color,box-shadow,scale] duration-500 ease-shop hover:bg-ink-2 hover:text-paper hover:shadow-lift active:scale-[.98] disabled:cursor-default disabled:opacity-60";
/** Sporedno dugme: pilula sa tankim okvirom. */
export const quietButtonClass =
  "inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-full px-[22px] font-display text-[14px] font-bold whitespace-nowrap text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-[background-color,box-shadow,scale] duration-500 ease-shop hover:bg-band hover:text-ink hover:shadow-[inset_0_0_0_1.5px_var(--color-ink)] active:scale-[.98] disabled:cursor-default disabled:opacity-50";
export const fileClass =
  "max-w-full font-sans text-[14px] font-normal text-muted file:mr-[12px] file:min-h-[40px] file:cursor-pointer file:rounded-full file:border-0 file:bg-band file:px-[18px] file:font-display file:text-[14px] file:font-bold file:text-ink";
export const cardClass = "rounded-[26px] bg-white p-[24px] shadow-soft";
/** Forma preko cele širine: kartice u dve kolone na širokom ekranu, jedna ispod druge na užem. */
export const formGridClass = "grid items-start gap-[16px] xl:grid-cols-2";
export const stackClass = "flex min-w-0 flex-col gap-[16px]";
/** Kartica sa grupom polja i njen naslov. */
export const panelClass = `${cardClass} flex min-w-0 flex-col gap-[16px]`;
export const panelTitleClass = "text-[20px]";
/** Polja jedno do drugog dok ima mesta. */
export const fieldRowClass =
  "grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-[16px]";
/** Filter ili tab: pilula, tamna dok je izabrana. */
export const chipClass =
  "inline-flex min-h-[42px] items-center rounded-full px-[18px] font-display text-[14px] font-semibold transition-colors duration-300";
export const chipOnClass = "bg-ink text-paper hover:text-paper";
export const chipOffClass = "bg-white text-ink hover:bg-ph hover:text-ink";
/** Link nazad i sporedni linkovi u tekstu. */
export const textLinkClass =
  "font-display text-[14px] font-bold underline decoration-line-strong hover:decoration-current";
/** Red u listi: sličica, tekst koji se širi, pa dugmad. */
export const rowClass =
  "flex flex-wrap items-center gap-[16px] border-t border-line py-[12px] first:border-t-0";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/svg+xml";
export const IMAGE_HINT = "JPG, PNG, WebP ili SVG, do 15 MB";

type PageHeaderProps = {
  title: string;
  /** Kratko objašnjenje ispod naslova. */
  hint?: ReactNode;
  /** Dugme ili link desno od naslova. */
  action?: ReactNode;
  /** Poruka o grešci iz adrese (?greska=…). */
  error?: string;
  /** Potvrda da je nešto urađeno (?ok=…). */
  notice?: string;
};

export function PageHeader({ title, hint, action, error, notice }: PageHeaderProps) {
  return (
    <>
      <div className="mb-[28px] flex flex-wrap items-end justify-between gap-[16px]">
        <div className="flex flex-col gap-[8px]">
          <h1 className="text-[clamp(32px,3.4vw,46px)] leading-[1.04] tracking-[-0.03em]">
            <span className="rise">
              <span>{title}</span>
            </span>
          </h1>
          {hint && <p className="max-w-[60ch] text-[15.5px] text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <ErrorNote message={error} />
      {notice && (
        <p
          role="status"
          className="mb-[24px] flex items-center gap-[12px] rounded-[18px] bg-white px-[18px] py-[14px] text-[15px] font-medium shadow-soft"
        >
          <span className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-gold text-[14px] font-bold">
            ✓
          </span>
          <Tr>{notice}</Tr>
        </p>
      )}
    </>
  );
}

type CheckboxProps = {
  name: string;
  /** Vrednost koja se šalje kada je polje označeno; bez nje pregledač šalje "on". */
  value?: string;
  defaultChecked?: boolean;
};

/**
 * Polje za potvrdu u stilu panela. Ispod je pravi <input type="checkbox">, pa
 * radi u formama, sa tastaturom i čitačima ekrana kao i obično; stavlja se
 * unutar <label>, uz tekst.
 */
export function Checkbox({ name, value, defaultChecked }: CheckboxProps) {
  return (
    <span className="relative inline-flex size-[22px] shrink-0">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer size-full cursor-pointer appearance-none rounded-[8px] border-[1.5px] border-line-strong bg-white transition-colors duration-300 checked:border-ink checked:bg-ink hover:border-ink"
      />
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto size-[12px] scale-50 text-paper opacity-0 transition-[opacity,scale] duration-150 peer-checked:scale-100 peer-checked:opacity-100"
      >
        <path
          d="M2 6.5 4.6 9 10 3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-[24px] rounded-[18px] bg-white px-[18px] py-[14px] text-[15px] font-medium shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
    >
      <Tr>{message}</Tr>
    </p>
  );
}

// Delovi sa sopstvenim tekstom su u ui-text.tsx, da prevod radi i u pregledaču.
import { Tr } from "./ui-text";

export { MailNotice, Pager, Thumb, Tr } from "./ui-text";

/** Koliko stavki staje na jednu stranu spiska u panelu (Proizvodi imaju svoje podešavanje). */
export const PANEL_PAGE_SIZE = 20;

/** Deo spiska za stranu iz adrese (?strana=N); strana preko kraja je poslednja. */
export function paginate<Item>(items: Item[], strana: string | undefined, size = PANEL_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(Math.max(Math.floor(Number(strana)) || 1, 1), pages);
  return { shown: items.slice((page - 1) * size, page * size), page, pages };
}
