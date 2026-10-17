"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { sizedSrc } from "@/lib/media";

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
  const t = useT();
  const frame = "h-[80px] w-[64px] shrink-0 rounded-[14px] bg-ph";
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center text-center text-[11px] text-muted ${frame}`}
      >
        {t("bez slike")}
      </div>
    );
  }
  return (
    // Sličica je najmanja veličina slike; stare slike i SVG se prikazuju kakvi jesu.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sizedSrc(src, 320)}
      alt={alt}
      width={64}
      height={80}
      loading="lazy"
      className={`${contain ? "object-contain p-[6px]" : "object-cover"} ${frame}`}
    />
  );
}

/**
 * Upozorenje tamo gde panel šalje email kupcu, dok email nije povezan: prodavnica šalje poruke
 * preko SMTP naloga svog domena, koji se upisuje u Podešavanjima.
 */
export function MailNotice({ configured, settingsPath }: { configured: boolean; settingsPath: string }) {
  const t = useT();
  if (configured) return null;
  return (
    <p role="status" className="mb-[16px] rounded-[18px] bg-white px-[18px] py-[14px] text-[15px] shadow-[inset_0_0_0_1.5px_var(--color-gold)]">
      <strong>{t("Email nije povezan,")}</strong> {t("pa kupci ne dobijaju potvrde, poruke o statusu ni podsetnike. Upišite SMTP nalog svog domena u")}{" "}
      <a href={settingsPath} className="font-display font-bold underline">
        {t("Podešavanja → Email kupcima")}
      </a>
      .
    </p>
  );
}

/** Tekst koji stiže sa servera na srpskom (poruka akcije u adresi, naziv iz jezgra), na jeziku panela. */
export function Tr({ children }: { children: string }) {
  return useT()(children);
}

type PagerProps = {
  /** Adresa spiska bez upitnika, npr. /admin/blog. */
  path: string;
  /** Ostali delovi adrese koji ostaju pri promeni strane (pretraga, filter, strane drugih spiskova). */
  params?: Record<string, string>;
  /** Ime parametra za stranu; drugo ime kada je na istoj stranici više spiskova. */
  param?: string;
  /** Sidro na stranici do kog se skroluje posle promene strane (#id). */
  anchor?: string;
  page: number;
  pages: number;
  /** Koliko stavki ima ukupno i kako se zovu, već prevedeno: „Članaka: 45". */
  summary: string;
};

/** Brojevi strana koji se prikazuju: prva, poslednja i dve oko trenutne; null je „…". */
function pageNumbers(page: number, pages: number): (number | null)[] {
  const shown = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return shown.flatMap((n, index) => (index > 0 && n - shown[index - 1] > 1 ? [null, n] : [n]));
}

/** Strane spiska u panelu (?strana=N): ukupan broj, prethodna i sledeća, i brojevi strana. Sa jednom stranom se ne prikazuje. */
export function Pager({ path, params = {}, param = "strana", anchor = "", page, pages, summary }: PagerProps) {
  const t = useT();
  const href = (n: number) => {
    const query = new URLSearchParams(Object.entries(params).filter(([name, value]) => value !== "" && name !== param));
    // Glavni spisak na prvoj strani nema parametar; ostali ga zadržavaju, da stranica zna koji je otvoren.
    if (n > 1 || param !== "strana") query.set(param, String(n));
    const text = query.toString();
    return `${text ? `${path}?${text}` : path}${anchor ? `#${anchor}` : ""}`;
  };
  // Sa jednom stranom nema šta da se bira, pa se ni broj ne ponavlja ispod spiska.
  if (pages <= 1) return null;
  const step =
    "inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full px-[14px] font-display text-[14px] font-bold transition-colors duration-300";
  return (
    <nav aria-label={t("Strane")} className="mt-[16px] flex flex-wrap items-center gap-[8px] text-[14px] text-muted">
      <span className="mr-[8px]">
        {summary}
        {pages > 1 && ` · ${t("strana {a} od {b}", { a: page, b: pages })}`}
      </span>
      {pages > 1 && (
        <>
          {page > 1 ? (
            <Link href={href(page - 1)} className={`${step} text-ink hover:bg-white`}>
              {t("← Prethodna")}
            </Link>
          ) : null}
          {pageNumbers(page, pages).map((n, index) =>
            n === null ? (
              <span key={`gap-${index}`} className="px-[4px]">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={href(n)}
                aria-current={n === page ? "page" : undefined}
                className={`${step} ${n === page ? "bg-ink text-paper hover:text-paper" : "text-ink hover:bg-white"}`}
              >
                {n}
              </Link>
            ),
          )}
          {page < pages ? (
            <Link href={href(page + 1)} className={`${step} text-ink hover:bg-white`}>
              {t("Sledeća →")}
            </Link>
          ) : null}
        </>
      )}
    </nav>
  );
}
