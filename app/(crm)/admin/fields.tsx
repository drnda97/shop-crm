"use client";

import { useT } from "@/lib/i18n/client";
import { useRef, useState, useTransition } from "react";
import { sizedSrc } from "@/lib/media";
import { IMAGE_POSITIONS, normalizeData, type Field, type ImageValue, type SectionData } from "@/lib/sections";
import { uploadImageAction } from "./actions";
import { IMAGE_ACCEPT, IMAGE_HINT, inputClass, labelClass, quietButtonClass } from "./ui";

/**
 * Forma napravljena iz opisa polja (lib/sections.ts). Koriste je uređivač stranica
 * (polja sekcije) i Izgled sajta (meni, podnožje).
 */

export type FieldOptions = {
  collections: { value: string; label: string }[];
  products: { value: string; label: string }[];
  /** Adrese koje se nude u poljima za link. */
  links: { value: string; label: string }[];
  /** Slike iz biblioteke, najnovije prve. */
  media: string[];
  /** Javlja uređivaču da je ubačena nova slika, da je ponudi i u ostalim poljima. */
  onUpload: (src: string) => void;
};

type FieldsProps = {
  fields: Field[];
  value: SectionData;
  onChange: (value: SectionData) => void;
  options: FieldOptions;
};

const smallButton =
  "flex size-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full font-display text-[15px] font-bold text-ink transition-colors duration-300 hover:bg-band disabled:cursor-default disabled:opacity-30";
const hintClass = "font-sans text-[13.5px] font-normal text-muted";

export function Fields({ fields, value, onChange, options }: FieldsProps) {
  return (
    <div className="flex flex-col gap-[16px]">
      {fields.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={value[field.key]}
          onChange={(next) => onChange({ ...value, [field.key]: next })}
          options={options}
        />
      ))}
    </div>
  );
}

type FieldInputProps = {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  options: FieldOptions;
};

function FieldInput({ field, value, onChange, options }: FieldInputProps) {
  const t = useT();
  const hint = field.hint && <span className={hintClass}>{t(field.hint)}</span>;

  switch (field.kind) {
    case "text":
      return (
        <label className={labelClass}>
          {t(field.label)}
          <input className={inputClass} value={value as string} onChange={(event) => onChange(event.target.value)} />
          {hint}
        </label>
      );
    case "textarea":
      return (
        <label className={labelClass}>
          {t(field.label)}
          <textarea
            className={`${inputClass} min-h-[110px]`}
            value={value as string}
            onChange={(event) => onChange(event.target.value)}
          />
          {hint}
        </label>
      );
    case "link":
      return (
        <label className={labelClass}>
          {t(field.label)}
          <input
            className={inputClass}
            list="link-options"
            placeholder={t("/kolekcija ili https://…")}
            value={value as string}
            onChange={(event) => onChange(event.target.value)}
          />
          {hint}
        </label>
      );
    case "color":
      return <ColorInput label={t(field.label)} value={value as string} onChange={onChange} />;
    case "boolean":
      return (
        <label className="flex cursor-pointer items-center gap-[10px] font-display text-[14px] font-semibold">
          <input
            type="checkbox"
            className="size-[20px] accent-ink"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
          />
          {t(field.label)}
        </label>
      );
    case "select":
    case "collection":
    case "product": {
      const list =
        field.kind === "select"
          ? field.options
          : [
              { value: "", label: field.kind === "collection" ? t("Svi proizvodi") : t("Bez proizvoda") },
              ...(field.kind === "collection" ? options.collections : options.products),
            ];
      return (
        <label className={labelClass}>
          {t(field.label)}
          <select className={inputClass} value={value as string} onChange={(event) => onChange(event.target.value)}>
            {list.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
          {hint}
        </label>
      );
    }
    case "image":
      return <ImageInput label={t(field.label)} value={value as ImageValue} onChange={onChange} options={options} />;
    case "list":
      return <ListInput field={field} value={value as SectionData[]} onChange={onChange} options={options} />;
  }
}

/* ---------- Boja ---------- */

type ColorInputProps = { label: string; value: string; onChange: (value: string) => void };

/** Birač boje i šifra koja može i da se upiše; dalje ide samo ispravna šifra (#rrggbb). */
function ColorInput({ label, value, onChange }: ColorInputProps) {
  const t = useT();
  const [typed, setTyped] = useState(value);
  return (
    <label className={labelClass}>
      {label}
      <span className="flex min-h-[50px] items-center gap-[10px] rounded-full border-[1.5px] border-line bg-white py-[5px] pr-[16px] pl-[5px] transition-colors duration-300 focus-within:border-ink hover:border-line-strong">
        <input
          type="color"
          aria-label={t("{a}: birač", { a: label })}
          value={value}
          onChange={(event) => {
            setTyped(event.target.value);
            onChange(event.target.value);
          }}
          className="size-[38px] shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-line-strong [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-line-strong [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          aria-label={t("{a}: šifra boje", { a: label })}
          value={typed}
          maxLength={7}
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value.trim();
            setTyped(next);
            if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase());
          }}
          className="min-w-0 grow bg-transparent font-sans text-[16px] font-medium outline-0"
        />
      </span>
    </label>
  );
}

/* ---------- Slika ---------- */

type ImageInputProps = {
  label: string;
  value: ImageValue;
  onChange: (value: ImageValue) => void;
  options: FieldOptions;
};

function ImageInput({ label, value, onChange, options }: ImageInputProps) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function upload(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("image", file);
    startTransition(async () => {
      const result = await uploadImageAction(formData);
      if (!result.ok) return setError(t(result.error));
      setError("");
      options.onUpload(result.src);
      onChange({ ...value, src: result.src });
    });
  }

  // Isecanje upisano u početnom sadržaju teme (npr. „70% 60%") ostaje u ponudi dok se ne promeni.
  const positions = IMAGE_POSITIONS.some((option) => option.value === value.position)
    ? IMAGE_POSITIONS
    : [...IMAGE_POSITIONS, { value: value.position, label: t("podešeno ({a})", { a: value.position }) }];

  return (
    <div className="flex flex-col gap-[10px]">
      <div className={labelClass}>{label}</div>
      <div className="flex flex-wrap items-center gap-[12px]">
        {value.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sizedSrc(value.src, 320)}
            alt=""
            className="h-[72px] w-[96px] shrink-0 rounded-[14px] bg-ph object-cover"
            style={value.position ? { objectPosition: value.position } : undefined}
          />
        ) : (
          <div className="flex h-[72px] w-[96px] shrink-0 items-center justify-center rounded-[14px] bg-ph text-[12px] text-muted">
            {t("bez slike")}
          </div>
        )}
        <div className="flex flex-wrap gap-[8px]">
          <input
            ref={input}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(event) => {
              upload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button type="button" className={quietButtonClass} disabled={pending} onClick={() => input.current?.click()}>
            {pending ? t("Šaljem…") : t("Ubaci sliku")}
          </button>
          <button type="button" className={quietButtonClass} aria-expanded={picking} onClick={() => setPicking(!picking)}>
            {t("Iz biblioteke")}
          </button>
          {value.src && (
            <button type="button" className={quietButtonClass} onClick={() => onChange({ ...value, src: "" })}>
              {t("Ukloni")}
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-[14px] font-semibold">{error}</p>
      ) : (
        <p className={hintClass}>{t(IMAGE_HINT)}</p>
      )}

      {picking && (
        <div className="grid max-h-[260px] grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-[8px] overflow-y-auto rounded-[16px] bg-band p-[10px]">
          {options.media.map((src) => (
            <button
              type="button"
              key={src}
              aria-label={t("Izaberi ovu sliku")}
              aria-pressed={src === value.src}
              className="cursor-pointer overflow-hidden rounded-[10px] outline-offset-2 aria-pressed:outline-2 aria-pressed:outline-ink"
              onClick={() => {
                onChange({ ...value, src });
                setPicking(false);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sizedSrc(src, 320)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          ))}
          {options.media.length === 0 && (
            <p className="col-span-full text-[14px] text-muted">{t("Biblioteka je prazna. Ubacite prvu sliku.")}</p>
          )}
        </div>
      )}

      {value.src && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-[12px]">
          <label className={labelClass}>
            {t("Opis slike")}
            <input
              className={inputClass}
              placeholder={t("Šta je na slici")}
              value={value.alt}
              onChange={(event) => onChange({ ...value, alt: event.target.value })}
            />
          </label>
          <label className={labelClass}>
            {t("Vidljiv deo kada se iseca")}
            <select
              className={inputClass}
              value={value.position}
              onChange={(event) => onChange({ ...value, position: event.target.value })}
            >
              {positions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

/* ---------- Lista ---------- */

type ListInputProps = {
  field: Extract<Field, { kind: "list" }>;
  value: SectionData[];
  onChange: (value: SectionData[]) => void;
  options: FieldOptions;
};

/** Naslov stavke u skupljenom obliku: prvi upisan tekst. */
function itemTitle(fields: Field[], item: SectionData): string {
  for (const field of fields) {
    const value = item[field.key];
    if ((field.kind === "text" || field.kind === "textarea") && typeof value === "string" && value.trim()) {
      return value.trim().split("\n")[0].slice(0, 60);
    }
  }
  return "";
}

function ListInput({ field, value, onChange, options }: ListInputProps) {
  const t = useT();
  // Koja je stavka otvorena; nova se otvara odmah.
  const [open, setOpen] = useState<number | null>(null);
  const full = value.length >= (field.max ?? 30);

  function move(index: number, by: number) {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
    setOpen(open === index ? index + by : null);
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <div className={labelClass}>{t(field.label)}</div>
      {field.hint && <span className={hintClass}>{t(field.hint)}</span>}
      {value.map((item, index) => {
        const title = itemTitle(field.fields, item);
        return (
          <div key={index} className="rounded-[18px] border-[1.5px] border-line">
            <div className="flex items-center gap-[2px] py-[4px] pr-[6px] pl-[14px]">
              <button
                type="button"
                aria-expanded={open === index}
                className="min-h-[40px] min-w-0 grow cursor-pointer truncate text-left font-display text-[14.5px] font-semibold"
                onClick={() => setOpen(open === index ? null : index)}
              >
                {t(field.itemLabel)} {index + 1}
                {title && <span className="font-sans font-normal text-muted"> · {title}</span>}
              </button>
              <button type="button" className={smallButton} aria-label={t("Pomeri gore")} disabled={index === 0} onClick={() => move(index, -1)}>
                ↑
              </button>
              <button type="button" className={smallButton} aria-label={t("Pomeri dole")} disabled={index === value.length - 1} onClick={() => move(index, 1)}>
                ↓
              </button>
              <button
                type="button"
                className={smallButton}
                aria-label={t("Ukloni: {a} {b}", { a: t(field.itemLabel), b: index + 1 })}
                onClick={() => {
                  onChange(value.filter((_, position) => position !== index));
                  setOpen(null);
                }}
              >
                ✕
              </button>
            </div>
            {open === index && (
              <div className="border-t border-line p-[14px]">
                <Fields
                  fields={field.fields}
                  value={item}
                  onChange={(next) => onChange(value.map((current, position) => (position === index ? next : current)))}
                  options={options}
                />
              </div>
            )}
          </div>
        );
      })}
      <div>
        <button
          type="button"
          className={quietButtonClass}
          disabled={full}
          onClick={() => {
            onChange([...value, normalizeData(field.fields, {})]);
            setOpen(value.length);
          }}
        >
          + {t(field.itemLabel)}
        </button>
      </div>
    </div>
  );
}

/** Ponuda adresa za sva polja za link na stranici; stavlja se jednom, uz formu. */
export function LinkOptions({ links }: { links: FieldOptions["links"] }) {
  return (
    <datalist id="link-options">
      {links.map((link) => (
        <option key={link.value} value={link.value}>
          {link.label}
        </option>
      ))}
    </datalist>
  );
}
