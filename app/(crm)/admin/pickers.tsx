"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/client";
import { sizedSrc } from "@/lib/media";
import { inputClass } from "./ui";

/** Pretraga ne gleda velika slova i kvačice: „fotelja skoljka" nalazi „Fotelja Školjka". */
function plain(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");
}

export type PickerOption = {
  value: string;
  label: string;
  /** Sitniji tekst ispod naziva, npr. putanja kategorije ili cena. */
  hint?: string;
  /** Sličica (npr. slika proizvoda). */
  image?: string;
};

type PickerProps = {
  /** Ime polja forme: za svaku izabranu vrednost po jedno skriveno polje. */
  name: string;
  options: PickerOption[];
  defaultValue: string[];
  /** Više vrednosti (čipovi) ili jedna. */
  multiple?: boolean;
  placeholder: string;
  /** Najviše izabranih (samo uz multiple). */
  max?: number;
  /** Natpis kada nema izbora, uz jedan izbor (npr. „Bez kategorije"). */
  noneLabel?: string;
  /** Opis polja za čitače ekrana. */
  label: string;
  /** Vrednosti koje se ne nude (npr. glavna kategorija među dodatnim). */
  exclude?: string[];
  onChange?: (values: string[]) => void;
};

/**
 * Izbor sa pretragom, umesto padajuće liste i višestrukog izbora uz Ctrl: kuca se deo naziva,
 * lista se sužava, klik ili Enter bira. Izabrano stoji kao čipovi sa ×. Strelice gore/dole
 * pomeraju izbor u listi, Esc je zatvara, Backspace u praznom polju uklanja poslednji čip.
 * Lista se iscrtava u <body>, pa je uvek iznad ostatka forme.
 */
export function Picker({ name, options, defaultValue, multiple = false, placeholder, max, noneLabel, label, exclude = [], onChange }: PickerProps) {
  const t = useT();
  const listId = useId();
  const [selected, setSelected] = useState<string[]>(defaultValue.filter((value) => options.some((option) => option.value === value)));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState({ top: 0, left: 0, width: 0, up: false });
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const byValue = new Map(options.map((option) => [option.value, option]));
  const words = plain(query).split(/\s+/).filter(Boolean);
  const found = options.filter(
    (option) => !exclude.includes(option.value) && words.every((word) => plain(`${option.label} ${option.hint ?? ""}`).includes(word)),
  );
  const full = multiple && max !== undefined && selected.length >= max;

  function measure() {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    // Lista ide ispod polja, a iznad ako ispod nema mesta.
    const up = window.innerHeight - rect.bottom < 280 && rect.top > window.innerHeight - rect.bottom;
    setPlace({ top: up ? rect.top - 6 : rect.bottom + 6, left: rect.left, width: rect.width, up });
  }

  function show() {
    measure();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!box.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  function update(next: string[]) {
    setSelected(next);
    onChange?.(next);
  }

  function choose(value: string) {
    if (!multiple) {
      update([value]);
      setQuery("");
      setOpen(false);
      return;
    }
    if (selected.includes(value)) update(selected.filter((item) => item !== value));
    else if (!full) update([...selected, value]);
    setQuery("");
    input.current?.focus();
  }

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) show();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => Math.min(Math.max(current + step, 0), Math.max(found.length - 1, 0)));
    } else if (event.key === "Enter") {
      // Enter u polju bira stavku, a ne šalje formu.
      event.preventDefault();
      if (open && found[active]) choose(found[active].value);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Backspace" && query === "" && multiple && selected.length > 0) {
      update(selected.slice(0, -1));
    }
  }

  const single = !multiple ? byValue.get(selected[0] ?? "") : undefined;

  return (
    <div className="flex flex-col gap-[8px]">
      {(multiple ? selected : []).map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      {!multiple && <input type="hidden" name={name} value={selected[0] ?? ""} />}

      <div
        ref={box}
        onClick={() => {
          input.current?.focus();
          show();
        }}
        // Jedan izbor stoji u jednom redu (kao obično polje); više izbora prelama čipove u nove redove.
        className={`${inputClass} flex h-auto cursor-text items-center gap-[8px] !py-[7px] focus-within:border-ink ${multiple ? "flex-wrap" : "flex-nowrap"}`}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="shrink-0 text-muted">
          <circle cx="9" cy="9" r="5.5" />
          <path d="m13.5 13.5 3 3" strokeLinecap="round" />
        </svg>
        {multiple &&
          selected.map((value) => {
            const option = byValue.get(value);
            if (!option) return null;
            return (
              <span key={value} className="inline-flex max-w-full items-center gap-[6px] rounded-full bg-band py-[3px] pr-[4px] pl-[4px] text-[14px] font-medium">
                {option.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sizedSrc(option.image, 320)} alt="" className="size-[24px] rounded-full object-cover" />
                ) : (
                  <span className="w-[6px]" />
                )}
                <span className="truncate">{option.label}</span>
                <button
                  type="button"
                  aria-label={t("Ukloni: {a}", { a: option.label })}
                  onClick={(event) => {
                    event.stopPropagation();
                    update(selected.filter((item) => item !== value));
                  }}
                  className="flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-white hover:text-ink"
                >
                  ×
                </button>
              </span>
            );
          })}
        {single && query === "" && !open && (
          <span className="flex min-w-0 flex-1 items-baseline gap-[8px] text-[16px]">
            <span className="min-w-0 shrink truncate">{single.label}</span>
            {single.hint && <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{single.hint}</span>}
          </span>
        )}
        <input
          ref={input}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={label}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            show();
          }}
          onFocus={show}
          onKeyDown={keys}
          placeholder={single && !open ? "" : multiple && selected.length > 0 ? t("Dodaj još…") : placeholder}
          // Dok je izbor prikazan, polje za kucanje ne zauzima mesto; otvaranjem dobija ceo red.
          className={`border-0 bg-transparent p-0 text-[16px] font-medium text-ink outline-0 placeholder:font-normal placeholder:text-muted ${
            single && !open ? "w-0 min-w-0 flex-none" : "min-w-[80px] flex-1"
          }`}
        />
        {!multiple && single && (
          <button
            type="button"
            aria-label={t("Ukloni izbor")}
            onClick={(event) => {
              event.stopPropagation();
              update([]);
            }}
            className="ml-auto flex size-[26px] flex-none cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-band hover:text-ink"
          >
            ×
          </button>
        )}
      </div>

      {open &&
        createPortal(
          <div
            ref={list}
            id={listId}
            role="listbox"
            aria-multiselectable={multiple}
            style={{ left: place.left, width: place.width, ...(place.up ? { bottom: window.innerHeight - place.top } : { top: place.top }) }}
            className="fixed z-50 max-h-[300px] animate-pop overflow-y-auto rounded-[18px] bg-white p-[6px] shadow-[0_24px_60px_-20px_rgba(14,39,48,0.45),0_0_0_1px_var(--color-line)]"
          >
            {!multiple && noneLabel && (
              <button
                type="button"
                role="option"
                aria-selected={selected.length === 0}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  update([]);
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center rounded-[12px] px-[12px] py-[9px] text-left text-[15px] text-muted hover:bg-band"
              >
                {noneLabel}
              </button>
            )}
            {found.map((option, index) => {
              const on = selected.includes(option.value);
              const blocked = !on && full;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  disabled={blocked}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option.value)}
                  className={`flex w-full cursor-pointer items-center gap-[10px] rounded-[12px] px-[10px] py-[8px] text-left text-[15px] disabled:cursor-default disabled:opacity-45 ${
                    index === active ? "bg-band" : ""
                  }`}
                >
                  {multiple && (
                    <span
                      aria-hidden
                      className={`flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] text-[12px] text-paper ${
                        on ? "border-ink bg-ink" : "border-line-strong"
                      }`}
                    >
                      {on && "✓"}
                    </span>
                  )}
                  {option.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sizedSrc(option.image, 320)} alt="" className="size-[34px] shrink-0 rounded-[9px] bg-ph object-cover" />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className={`truncate ${on && !multiple ? "font-bold" : "font-medium"}`}>{option.label}</span>
                    {option.hint && <span className="truncate text-[13px] text-muted">{option.hint}</span>}
                  </span>
                </button>
              );
            })}
            {found.length === 0 && <p className="px-[12px] py-[10px] text-[14.5px] text-muted">{t("Nema rezultata za „{a}”.", { a: query })}</p>}
            {full && <p className="px-[12px] pt-[6px] pb-[8px] text-[13px] text-muted">{t("Izabrano je najviše ({a}).", { a: max ?? 0 })}</p>}
          </div>,
          document.body,
        )}
    </div>
  );
}

export type RowField = {
  key: string;
  label: string;
  placeholder?: string;
  /** Duži tekst: više redova. */
  multiline?: boolean;
};

type RowsEditorProps = {
  /** Ime skrivenog polja forme; vrednost je JSON niz redova. */
  name: string;
  fields: RowField[];
  defaultRows: Record<string, string>[];
  addLabel: string;
  /** Tekst kada nema nijednog reda. */
  emptyLabel: string;
  max?: number;
  /**
   * „stacked": svaki red je kartica, prvo polje preko cele širine, a drugo (duži tekst) ispod
   * njega, sa visinom po sadržaju. „inline": polja jedno do drugog (kratke vrednosti, npr. mere).
   */
  layout?: "stacked" | "inline";
};

/** Visina polja po sadržaju, da se ceo tekst vidi bez pomeranja unutar polja. */
function fit(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + 3}px`;
}

/**
 * Spisak redova sa poljima (npr. dodatne sekcije: Naslov i Tekst; mere: Naziv i Vrednost),
 * umesto jednog polja u koje se piše „Naslov: tekst". Red se dodaje, briše i pomera.
 * Red u kom je sve prazno se ne čuva.
 */
export function RowsEditor({ name, fields, defaultRows, addLabel, emptyLabel, max = 30, layout = "inline" }: RowsEditorProps) {
  const t = useT();
  const blank = () => Object.fromEntries(fields.map((field) => [field.key, ""]));
  // Ključ reda ostaje isti pri pomeranju, da polje u kom se kuca ne izgubi fokus.
  const [rows, setRows] = useState(() => defaultRows.map((row, index) => ({ id: index, values: { ...blank(), ...row } })));
  const [nextId, setNextId] = useState(defaultRows.length);
  const filled = rows.map((row) => row.values).filter((values) => fields.some((field) => values[field.key]?.trim()));

  function set(id: number, key: string, value: string) {
    setRows(rows.map((row) => (row.id === id ? { ...row, values: { ...row.values, [key]: value } } : row)));
  }

  function move(index: number, step: number) {
    const next = [...rows];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setRows(next);
  }

  const small = "flex size-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full text-[15px] text-muted transition-colors hover:bg-band hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="flex flex-col gap-[10px]">
      <input type="hidden" name={name} value={JSON.stringify(filled)} />
      {rows.length === 0 && <p className="text-[14.5px] text-muted">{emptyLabel}</p>}
      {rows.map((row, index) => {
        const controls = (
          <div className="flex shrink-0 items-center">
            <button type="button" className={small} aria-label={t("Pomeri gore")} disabled={index === 0} onClick={() => move(index, -1)}>
              ↑
            </button>
            <button type="button" className={small} aria-label={t("Pomeri dole")} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
              ↓
            </button>
            <button type="button" className={small} aria-label={t("Ukloni red {a}", { a: index + 1 })} onClick={() => setRows(rows.filter((item) => item.id !== row.id))}>
              ×
            </button>
          </div>
        );
        const field = (item: RowField, extra = "") =>
          item.multiline ? (
            <textarea
              key={item.key}
              ref={fit}
              aria-label={`${item.label} ${index + 1}`}
              placeholder={item.placeholder ?? item.label}
              value={row.values[item.key]}
              onChange={(event) => {
                set(row.id, item.key, event.target.value);
                fit(event.target);
              }}
              rows={3}
              className={`${inputClass} min-h-[92px] resize-none overflow-hidden leading-[1.55] ${extra}`}
            />
          ) : (
            <input
              key={item.key}
              aria-label={`${item.label} ${index + 1}`}
              placeholder={item.placeholder ?? item.label}
              value={row.values[item.key]}
              onChange={(event) => set(row.id, item.key, event.target.value)}
              className={`${inputClass} ${extra}`}
            />
          );

        if (layout === "stacked") {
          const [head, ...rest] = fields;
          return (
            <div key={row.id} className="flex flex-col gap-[10px] rounded-[20px] bg-band p-[14px]">
              <div className="flex items-center gap-[10px]">
                <span className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-white font-display text-[13px] font-bold text-muted">
                  {index + 1}
                </span>
                <div className="min-w-0 grow">{field(head, "font-display font-bold")}</div>
                {controls}
              </div>
              {rest.map((item) => field(item))}
            </div>
          );
        }
        return (
          <div key={row.id} className="flex items-center gap-[8px] rounded-[18px] bg-band p-[8px]">
            <div className={`grid min-w-0 grow gap-[8px] ${fields.length > 1 ? "sm:grid-cols-2" : ""}`}>{fields.map((item) => field(item))}</div>
            {controls}
          </div>
        );
      })}
      {rows.length < max && (
        <button
          type="button"
          onClick={() => {
            setRows([...rows, { id: nextId, values: blank() }]);
            setNextId(nextId + 1);
          }}
          className="inline-flex min-h-[44px] w-fit cursor-pointer items-center gap-[8px] rounded-full px-[18px] font-display text-[14px] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-colors hover:bg-band"
        >
          + {addLabel}
        </button>
      )}
    </div>
  );
}
