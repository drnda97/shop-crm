"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageUse } from "@/lib/content";
import { useT } from "@/lib/i18n/client";
import { IMAGE_WIDTHS, mediaFormat, mediaName, sizedSrc } from "@/lib/media";
import { deleteImageAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { chipClass, chipOffClass, chipOnClass, inputClass, quietButtonClass, textLinkClass } from "../ui";
import { saveMediaView } from "./view-cookie";

export type LibraryImage = { src: string; bytes: number; addedAt: number; hasSizes: boolean; uses: ImageUse[] };

const useLabels: Record<ImageUse["kind"], string> = {
  product: "Proizvod",
  collection: "Kolekcija",
  page: "Stranica",
  template: "Stranica sa stalnim rasporedom",
  blog: "Članak",
  logo: "Logo",
  favicon: "Favicon",
};

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Pretraga se ne obazire na velika slova, crtice i kvačice: „fotelja mio" nalazi „Fotelja-Mio". */
function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "dj")
    .replace(/[-_]+/g, " ");
}

const PAGE_SIZE = 60;
/** Padajući meni u redu sa pretragom: širok koliko i njegov tekst, ne preko celog reda. */
const selectClass = `${inputClass.replace("w-full ", "")} w-auto shrink-0`;

const FILTERS = { all: "Sve", used: "Na sajtu", unused: "Ne koriste se" } as const;
type Filter = keyof typeof FILTERS;

const SORTS = {
  newest: "Najnovije prvo",
  oldest: "Najstarije prvo",
  name: "Po imenu, A–Ž",
  largest: "Najveći fajlovi prvo",
  smallest: "Najmanji fajlovi prvo",
} as const;
type Sort = keyof typeof SORTS;

const compare: Record<Sort, (a: LibraryImage, b: LibraryImage) => number> = {
  newest: (a, b) => b.addedAt - a.addedAt,
  oldest: (a, b) => a.addedAt - b.addedAt,
  name: (a, b) => mediaName(a.src).localeCompare(mediaName(b.src), "sr"),
  largest: (a, b) => b.bytes - a.bytes,
  smallest: (a, b) => a.bytes - b.bytes,
};

/**
 * Biblioteka slika: pretraga po imenu i mestu upotrebe, filter po upotrebi i formatu, redosled
 * i prikaz po PAGE_SIZE slika. Klik na sliku otvara njene podatke. Filter i redosled se pamte u
 * kolačiću (view-cookie.ts).
 */
export function MediaLibrary({ images, view }: { images: LibraryImage[]; view: string }) {
  const t = useT();
  const [savedFilter, savedSort] = view.split(":");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(savedFilter in FILTERS ? (savedFilter as Filter) : "all");
  const [format, setFormat] = useState("");
  const [sort, setSort] = useState<Sort>(savedSort in SORTS ? (savedSort as Sort) : "newest");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<LibraryImage | null>(null);
  const more = useRef<HTMLDivElement>(null);

  function remember(next: { filter?: Filter; sort?: Sort }) {
    saveMediaView(`${next.filter ?? filter}:${next.sort ?? sort}`);
  }

  // Svaka promena pretrage ili filtera kreće od prve strane.
  function change<V>(set: (value: V) => void) {
    return (value: V) => {
      set(value);
      setLimit(PAGE_SIZE);
    };
  }

  const formats = [...new Set(images.map((image) => mediaFormat(image.src)))].sort();
  const words = plain(query).split(/\s+/).filter(Boolean);
  const matching = images.filter((image) => {
    if (format && mediaFormat(image.src) !== format) return false;
    const haystack = plain([mediaName(image.src), ...image.uses.map((use) => use.name)].join(" "));
    return words.every((word) => haystack.includes(word));
  });
  const counts: Record<Filter, number> = {
    all: matching.length,
    used: matching.filter((image) => image.uses.length > 0).length,
    unused: matching.filter((image) => image.uses.length === 0).length,
  };
  const filtered = matching
    .filter((image) => filter === "all" || (filter === "used") === image.uses.length > 0)
    .sort(compare[sort]);
  const shown = filtered.slice(0, limit);
  const left = filtered.length - shown.length;

  // Sledeća strana se učitava sama kada se dođe do dna spiska.
  useEffect(() => {
    const target = more.current;
    if (!target || left === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLimit((current) => current + PAGE_SIZE);
      },
      { rootMargin: "600px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [left]);

  return (
    <>
      <div className="mb-[16px] flex flex-wrap items-center gap-[10px]">
        <input
          type="search"
          value={query}
          onChange={(event) => change(setQuery)(event.target.value)}
          placeholder={t("Pretraga po imenu, proizvodu ili stranici")}
          aria-label={t("Pretraga slika")}
          className={`${inputClass} min-w-[220px] flex-1 basis-[260px]`}
        />
        <div className="flex flex-wrap items-center gap-[8px]" role="group" aria-label={t("Upotreba")}>
          {(Object.keys(FILTERS) as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => {
                change(setFilter)(key);
                remember({ filter: key });
              }}
              className={`${chipClass} cursor-pointer gap-[6px] whitespace-nowrap ${filter === key ? chipOnClass : chipOffClass}`}
            >
              {t(FILTERS[key])}
              <span className="opacity-60">{counts[key]}</span>
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(event) => {
            const value = event.target.value as Sort;
            change(setSort)(value);
            remember({ sort: value });
          }}
          aria-label={t("Redosled")}
          className={selectClass}
        >
          {(Object.keys(SORTS) as Sort[]).map((key) => (
            <option key={key} value={key}>
              {t(SORTS[key])}
            </option>
          ))}
        </select>
        {formats.length > 1 && (
          <select
            value={format}
            onChange={(event) => change(setFormat)(event.target.value)}
            aria-label={t("Format")}
            className={selectClass}
          >
            <option value="">{t("Svi formati")}</option>
            {formats.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        {filtered.length > 0 && (
          <span className="ml-auto text-[14px] whitespace-nowrap text-muted">
            {t("Prikazano {n} od {m}", { n: shown.length, m: filtered.length })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-[16px]">
        {shown.map((image) => (
          <button
            key={image.src}
            type="button"
            onClick={() => setOpen(image)}
            className="flex cursor-pointer flex-col overflow-hidden rounded-[22px] bg-white text-left shadow-soft transition-shadow duration-300 hover:shadow-lift"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sizedSrc(image.src, 320)} alt="" loading="lazy" className="aspect-[4/3] w-full bg-ph object-cover" />
            <span className="truncate px-[14px] py-[10px] font-display text-[13.5px] font-semibold text-ink" title={mediaName(image.src)}>
              {mediaName(image.src)}
            </span>
          </button>
        ))}
      </div>
      {images.length === 0 && <p className="text-[15px] text-muted">{t("Još nema ubačenih slika.")}</p>}
      {images.length > 0 && filtered.length === 0 && <p className="text-[15px] text-muted">{t("Nijedna slika ne odgovara pretrazi.")}</p>}
      {left > 0 && (
        <div ref={more} className="mt-[24px] flex justify-center">
          <button type="button" onClick={() => setLimit((current) => current + PAGE_SIZE)} className={quietButtonClass}>
            {t("Prikaži još ({n})", { n: left })}
          </button>
        </div>
      )}

      {open && <ImageDialog image={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ImageDialog({ image, onClose }: { image: LibraryImage; onClose: () => void }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [dimensions, setDimensions] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    // Dimenzije najveće veličine, one koja se čuva u sadržaju.
    const probe = new Image();
    probe.onload = () => setDimensions(`${probe.naturalWidth} × ${probe.naturalHeight} px`);
    probe.src = image.src;
  }, [image.src]);

  async function copy() {
    await navigator.clipboard.writeText(image.src);
    setCopied(true);
  }

  const details: [string, string][] = [
    [t("Veličina fajla"), size(image.bytes)],
    [t("Format"), mediaFormat(image.src)],
    ...(dimensions ? [[t("Dimenzije"), dimensions] as [string, string]] : []),
    ...(image.hasSizes ? [[t("Manje veličine"), IMAGE_WIDTHS.map((width) => `${width}`).join(", ") + " px"] as [string, string]] : []),
    [t("Ubačena"), new Date(image.addedAt).toLocaleString()],
  ];

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
      className="m-auto w-[min(960px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-auto rounded-[26px] bg-white p-0 text-ink shadow-lift backdrop:bg-ink/60"
    >
      <div className="grid gap-[24px] p-[24px] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sizedSrc(image.src, 1024)}
          alt=""
          className="max-h-[70vh] w-full rounded-[18px] bg-ph object-contain"
        />
        <div className="flex min-w-0 flex-col gap-[16px]">
          <div className="flex items-start justify-between gap-[12px]">
            <h2 className="text-[20px] break-all">{mediaName(image.src)}</h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label={t("Zatvori")}
              className="cursor-pointer rounded-full px-[10px] text-[24px] leading-none text-muted hover:text-ink"
            >
              ×
            </button>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-[16px] gap-y-[6px] text-[14px]">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-[6px] text-[14px]">
            <span className="text-muted">{t("Na sajtu")}</span>
            {image.uses.length === 0 ? (
              <span>{t("Ne koristi se. Može da se obriše.")}</span>
            ) : (
              <ul className="flex flex-col gap-[2px]">
                {image.uses.map((use) => (
                  <li key={`${use.kind}:${use.name}`}>
                    {t(useLabels[use.kind])}
                    {use.name && `: ${use.kind === "template" ? t(use.name) : use.name}`}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-[6px] text-[14px]">
            <span className="text-muted">{t("Adresa")}</span>
            <code className="rounded-[10px] bg-band px-[10px] py-[6px] text-[13px] break-all">{image.src}</code>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-[12px]">
            <button type="button" onClick={copy} className={quietButtonClass}>
              {copied ? t("Kopirano") : t("Kopiraj adresu")}
            </button>
            <a href={image.src} target="_blank" rel="noreferrer" className={textLinkClass}>
              {t("Otvori u punoj veličini")}
            </a>
            {image.uses.length === 0 && (
              <form action={deleteImageAction} className="ml-auto">
                <input type="hidden" name="src" value={image.src} />
                <ConfirmButton question={t("Obrisati ovu sliku?")} className={textLinkClass}>
                  {t("Obriši")}
                </ConfirmButton>
              </form>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
