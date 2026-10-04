import Image from "next/image";
import type { ReactNode } from "react";

/** Zajednički stilovi i sitni delovi admin panela. */

export const inputClass =
  "min-h-[44px] w-full rounded-[6px] border border-line-strong bg-white px-[12px] py-[8px] text-[16px] text-ink";
export const labelClass = "flex flex-col gap-[4px] text-[14px] text-muted";
export const buttonClass =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-[6px] bg-ink px-[20px] text-[14px] text-paper hover:bg-accent hover:text-paper";
export const quietButtonClass =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-[6px] border border-line-strong bg-white px-[16px] text-[14px] text-ink hover:border-ink hover:text-ink";
export const fileClass = "max-w-full text-[14px] text-muted";
export const cardClass = "rounded-[10px] border border-line bg-white p-[20px]";
/** Red u listi: sličica, tekst koji se širi, pa dugmad. */
export const rowClass =
  "flex flex-wrap items-center gap-[16px] border-t border-line py-[12px] first:border-t-0";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const IMAGE_HINT = "JPG, PNG ili WebP, do 15 MB";

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
      <div className="mb-[24px] flex flex-wrap items-start justify-between gap-[16px]">
        <div className="flex flex-col gap-[4px]">
          <h1 className="text-[28px] leading-[1.2]">{title}</h1>
          {hint && <p className="max-w-[60ch] text-[15px] text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <ErrorNote message={error} />
      {notice && (
        <p
          role="status"
          className="mb-[24px] rounded-[6px] border border-line-strong bg-white px-[16px] py-[12px] text-[15px]"
        >
          ✓ {notice}
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
        className="peer size-full cursor-pointer appearance-none rounded-[6px] border border-line-strong bg-white transition-colors checked:border-ink checked:bg-ink hover:border-ink"
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
      className="mb-[24px] rounded-[6px] border border-ink bg-white px-[16px] py-[12px] text-[15px]"
    >
      {message}
    </p>
  );
}

/** Trenutna slika, ili prazan okvir ako je nema. `contain`: cela slika bez sečenja (logo, favicon). */
export function Thumb({
  src,
  alt,
  contain = false,
}: {
  src?: string;
  alt: string;
  contain?: boolean;
}) {
  const frame = "h-[80px] w-[64px] shrink-0 rounded-[4px] bg-ph";
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center text-center text-[11px] text-muted ${frame}`}
      >
        bez slike
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={64}
      height={80}
      // SVG (podrazumevani favicon) ne prolazi kroz optimizaciju slika.
      unoptimized={src.endsWith(".svg")}
      className={`${contain ? "object-contain p-[6px]" : "object-cover"} ${frame}`}
    />
  );
}
