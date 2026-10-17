"use client";

import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useState } from "react";
import { countCombinations, formatOptions, MAX_VARIANTS, syncVariants, variantLabel, type ProductOption, type Variant } from "@/lib/catalog";
import { fromMinor, type Currency } from "@/lib/format";
import { sizedSrc } from "@/lib/media";
import { inputClass, labelClass } from "./ui";

/** Red tabele dok se uređuje: cene i broj komada su tekst, kako ih je vlasnik upisao. */
export type VariantRow = {
  enabled: boolean;
  price: string;
  salePrice: string;
  sku: string;
  stockQty: string;
  image: string;
};

type VariantsEditorProps = {
  /** Sačuvane opcije proizvoda. */
  options: ProductOption[];
  variants: Variant[];
  /** Slike proizvoda koje su već sačuvane; od njih se bira slika varijante. */
  images: string[];
  currency: Currency;
  /** Sačuvan proizvod: adresa stranica njegovih varijanti (link „Uredi" vodi na {variantBase}/{id}). */
  variantBase?: string;
};

const bulkLabels = { price: "Cena", salePrice: "Na akciji", stockQty: "Komada", sku: "Šifra" } as const;

const cellInput =
  "min-h-[40px] w-full min-w-[84px] rounded-[12px] border-[1.5px] border-line bg-white px-[10px] font-sans text-[15px] font-medium text-ink focus:border-ink focus:outline-0";

function toRow(variant: Variant | undefined, decimals: number): VariantRow {
  return {
    enabled: variant?.enabled ?? true,
    price: fromMinor(variant?.price, decimals),
    salePrice: fromMinor(variant?.salePrice, decimals),
    sku: variant?.sku ?? "",
    stockQty: variant?.stockQty == null ? "" : String(variant.stockQty),
    image: variant?.image ?? "",
  };
}

/** Opcija dok se uređuje: `colors` uključuje kružić u boji uz svaku vrednost, `draft` je vrednost koja se kuca. */
type OptionDraft = { id: number; name: string; colors: boolean; values: { label: string; color?: string }[]; draft: string };

/** Česte opcije, kao predlog pri upisu naziva. */
const SUGGESTED = ["Veličina", "Boja", "Materijal", "Tkanina", "Dimenzije", "Model"];
const MAX_VALUES = 24;
/** Gotovi nizovi vrednosti, da se veličine ne upisuju jedna po jedna. */
const PRESETS = [
  { label: "XS – XXL", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  { label: "36 – 46", values: Array.from({ length: 11 }, (_, index) => String(36 + index)) },
  { label: "1 – 10", values: Array.from({ length: 10 }, (_, index) => String(index + 1)) },
];

function toDrafts(options: ProductOption[]): OptionDraft[] {
  return options.map((option, index) => ({
    id: index,
    name: option.name,
    colors: option.values.some((value) => value.color),
    values: option.values,
    draft: "",
  }));
}

/** Opcije za čuvanje: bez praznih; naziv bez dvotačke, vrednost bez zareza (to su razdelnici u zapisu). */
function cleanOptions(drafts: OptionDraft[]): ProductOption[] {
  return drafts
    .map((option, index) => ({
      name: option.name.replace(/[:\n]/g, " ").trim() || `Opcija ${index + 1}`,
      values: option.values.map((value) => (option.colors && value.color ? value : { label: value.label })),
    }))
    .filter((option) => option.values.length > 0);
}

/**
 * Opcije proizvoda (kao u Shopify-ju: naziv opcije, vrednosti kao čipovi, po želji boja uz
 * svaku vrednost) i tabela varijanti. Varijante nastaju same, po jedna za svaku kombinaciju
 * vrednosti; uz svaku se upisuju cena, šifra i broj komada. U formu idu polja `options`
 * (zapis „Naziv: vrednost, vrednost #boja") i `variants` (JSON po id-u varijante).
 */
export function VariantsEditor({ options: saved, variants: existing, images, currency, variantBase }: VariantsEditorProps) {
  const t = useT();
  const savedIds = existing.map((variant) => variant.id);
  // Označene varijante i vrednosti koje se upisuju u sve njih odjednom.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState({ price: "", salePrice: "", stockQty: "", sku: "" });
  const [drafts, setDrafts] = useState<OptionDraft[]>(() => toDrafts(saved));
  const [nextId, setNextId] = useState(saved.length);
  const [rows, setRows] = useState<Record<string, VariantRow>>(
    Object.fromEntries(existing.map((variant) => [variant.id, toRow(variant, currency.decimals)])),
  );

  const options = cleanOptions(drafts);
  const count = countCombinations(options);
  const variants = syncVariants(options, []);
  const row = (id: string) => rows[id] ?? toRow(undefined, currency.decimals);
  const change = (id: string, next: Partial<VariantRow>) => setRows({ ...rows, [id]: { ...row(id), ...next } });
  const step = currency.decimals === 0 ? "1" : "0.01";
  const allEnabled = [...selected].every((id) => row(id).enabled);

  const edit = (id: number, next: Partial<OptionDraft>) => setDrafts(drafts.map((option) => (option.id === id ? { ...option, ...next } : option)));
  /** Dodaje vrednost iz polja (Enter ili zarez) ili ceo niz odjednom; ista vrednost se ne ponavlja. */
  function addValue(option: OptionDraft, list?: string[]) {
    const labels = (list ?? option.draft.split(",")).map((item) => item.trim().slice(0, 60)).filter(Boolean);
    const values = [...option.values];
    for (const label of labels) {
      if (values.length >= MAX_VALUES || values.some((value) => value.label.toLowerCase() === label.toLowerCase())) continue;
      values.push(option.colors ? { label, color: "#cccccc" } : { label });
    }
    edit(option.id, { values, draft: list ? option.draft : "" });
  }

  return (
    <>
      <input type="hidden" name="options" value={formatOptions(options)} />
      <input
        type="hidden"
        name="variants"
        value={JSON.stringify(Object.fromEntries(variants.map((variant) => [variant.id, row(variant.id)])))}
      />
      <datalist id="option-names">
        {SUGGESTED.map((name) => (
          <option key={name} value={t(name)} />
        ))}
      </datalist>

      {drafts.length === 0 && (
        <p className="text-[15px] text-muted">
          {t("Proizvod nema opcije: kupac ga poručuje bez izbora. Dodajte opciju ako se prodaje u više veličina, boja ili materijala.")}
        </p>
      )}

      <div className="flex flex-col gap-[10px]">
        {drafts.map((option, index) => (
          <div key={option.id} className="flex flex-col gap-[12px] rounded-[20px] bg-band p-[16px]">
            <div className="flex flex-wrap items-end gap-[12px]">
              <label className={`${labelClass} min-w-[200px] grow basis-[220px]`}>
                {t("Naziv opcije")}
                <input
                  list="option-names"
                  value={option.name}
                  maxLength={60}
                  placeholder={t("npr. Veličina")}
                  onChange={(event) => edit(option.id, { name: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="flex min-h-[50px] cursor-pointer items-center gap-[10px] text-[15px]">
                <input
                  type="checkbox"
                  checked={option.colors}
                  onChange={(event) =>
                    edit(option.id, {
                      colors: event.target.checked,
                      values: option.values.map((value) => (event.target.checked ? { ...value, color: value.color ?? "#cccccc" } : { label: value.label })),
                    })
                  }
                  className="size-[18px] accent-ink"
                />
                {t("Vrednosti su boje (kružić na sajtu)")}
              </label>
              <button
                type="button"
                onClick={() => setDrafts(drafts.filter((item) => item.id !== option.id))}
                className="min-h-[50px] cursor-pointer rounded-full px-[16px] font-display text-[14px] font-bold text-muted transition-colors hover:bg-white hover:text-ink"
              >
                {t("Ukloni opciju")}
              </button>
            </div>

            <div className={labelClass}>
              {t("Vrednosti")}
              <div
                className={`${inputClass} flex h-auto flex-wrap items-center gap-[6px] !py-[7px] focus-within:border-ink`}
                onClick={(event) => (event.currentTarget.querySelector("input[data-draft]") as HTMLInputElement | null)?.focus()}
              >
                {option.values.map((value, valueIndex) => (
                  <span key={value.label} className="inline-flex items-center gap-[6px] rounded-full bg-band py-[3px] pr-[4px] pl-[6px] text-[14px] font-medium">
                    {option.colors && (
                      <label className="relative size-[22px] shrink-0 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgba(14,39,48,0.2)]" style={{ background: value.color }}>
                        <span className="sr-only">{t("Boja: {a}", { a: value.label })}</span>
                        <input
                          type="color"
                          value={value.color ?? "#cccccc"}
                          onChange={(event) =>
                            edit(option.id, {
                              values: option.values.map((item, at) => (at === valueIndex ? { ...item, color: event.target.value } : item)),
                            })
                          }
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                      </label>
                    )}
                    {value.label}
                    <button
                      type="button"
                      aria-label={t("Ukloni: {a}", { a: value.label })}
                      onClick={() => edit(option.id, { values: option.values.filter((_, at) => at !== valueIndex) })}
                      className="flex size-[22px] cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-white hover:text-ink"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  data-draft
                  value={option.draft}
                  aria-label={t("Nova vrednost za opciju {a}", { a: option.name || index + 1 })}
                  placeholder={option.values.length === 0 ? t("Upišite vrednost i pritisnite Enter, npr. S") : t("Dodaj vrednost…")}
                  onChange={(event) => {
                    const value = event.target.value;
                    // Zarez odmah pravi vrednost, kao Enter.
                    if (value.includes(",")) {
                      const next = { ...option, draft: value };
                      addValue(next);
                    } else edit(option.id, { draft: value });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addValue(option);
                    } else if (event.key === "Backspace" && option.draft === "" && option.values.length > 0) {
                      edit(option.id, { values: option.values.slice(0, -1) });
                    }
                  }}
                  onBlur={() => option.draft.trim() && addValue(option)}
                  className="min-w-[160px] grow border-0 bg-transparent p-0 text-[16px] font-medium text-ink outline-0 placeholder:font-normal placeholder:text-muted"
                />
              </div>
              <div className="flex flex-wrap items-center gap-[6px] font-sans text-[13.5px] font-normal text-muted">
                {t("Brzo dodaj niz:")}
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => addValue(option, preset.values)}
                    className="cursor-pointer rounded-full bg-white px-[10px] py-[3px] font-display text-[13px] font-bold text-ink transition-colors hover:bg-ph"
                  >
                    {preset.label}
                  </button>
                ))}
                <span>{t("ili nalepite više vrednosti odvojenih zarezom: S, M, L, XL")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setDrafts([...drafts, { id: nextId, name: "", colors: false, values: [], draft: "" }]);
          setNextId(nextId + 1);
        }}
        className="inline-flex min-h-[44px] w-fit cursor-pointer items-center gap-[8px] rounded-full px-[18px] font-display text-[14px] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-colors hover:bg-band"
      >
        + {drafts.length === 0 ? t("Dodaj opciju (veličina, boja…)") : t("Dodaj još jednu opciju")}
      </button>

      {count > MAX_VARIANTS && (
        <p role="alert" className="rounded-[16px] bg-band px-[16px] py-[12px] text-[14.5px] font-medium">
          {t("Ove opcije daju")} {count} {t("kombinacija, a proizvod može imati najviše")} {MAX_VARIANTS} {t("varijanti. Smanjite broj vrednosti ili podelite proizvod na više proizvoda.")}
        </p>
      )}

      {variants.length > 0 && (
        <div className="flex flex-wrap items-end gap-[10px] rounded-[18px] bg-band p-[12px]">
          <span className="min-h-[40px] grow basis-full font-display text-[14px] font-bold sm:basis-auto sm:self-center">
            {selected.size > 0 ? t("Označeno: {a} od {b}", { a: selected.size, b: variants.length }) : t("Ista vrednost za više varijanti odjednom: označite ih levo u tabeli")}
          </span>
          {(["price", "salePrice", "stockQty", "sku"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-[4px] font-display text-[13px] font-semibold text-muted">
              {t(bulkLabels[key])}
              <input
                type={key === "sku" ? "text" : "number"}
                min="0"
                step={key === "stockQty" ? "1" : step}
                value={bulk[key]}
                onChange={(event) => setBulk({ ...bulk, [key]: event.target.value })}
                className={`${cellInput} w-[120px]`}
              />
            </label>
          ))}
          <button
            type="button"
            disabled={selected.size === 0 || Object.values(bulk).every((value) => value === "")}
            onClick={() => {
              const next = { ...rows };
              for (const id of selected) {
                const current = row(id);
                next[id] = {
                  ...current,
                  ...Object.fromEntries(Object.entries(bulk).filter(([, value]) => value !== "")),
                };
              }
              setRows(next);
              setBulk({ price: "", salePrice: "", stockQty: "", sku: "" });
            }}
            className="min-h-[40px] cursor-pointer rounded-full bg-ink px-[18px] font-display text-[14px] font-bold text-paper transition-colors hover:bg-ink-2 disabled:cursor-default disabled:opacity-40"
          >
            {t("Primeni na označene")}
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setRows({ ...rows, ...Object.fromEntries([...selected].map((id) => [id, { ...row(id), enabled: !allEnabled }])) })}
            className="min-h-[40px] cursor-pointer rounded-full px-[14px] font-display text-[14px] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-colors hover:bg-white disabled:cursor-default disabled:opacity-40"
          >
            {allEnabled ? t("Skloni iz ponude") : t("Vrati u ponudu")}
          </button>
        </div>
      )}

      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-[6px] text-left text-[14px]">
            <thead>
              <tr className="font-display text-[13px] font-semibold text-muted">
                <th className="w-[36px] pr-[6px] font-semibold">
                  <input
                    type="checkbox"
                    aria-label={t("Označi sve varijante")}
                    checked={selected.size === variants.length}
                    onChange={(event) => setSelected(new Set(event.target.checked ? variants.map((variant) => variant.id) : []))}
                    className="size-[18px] accent-ink"
                  />
                </th>
                <th className="pr-[10px] font-semibold">{t("Varijanta")}</th>
                <th className="pr-[8px] font-semibold">{t("Cena (")}{currency.code})</th>
                <th className="pr-[8px] font-semibold">{t("Na akciji")}</th>
                <th className="pr-[8px] font-semibold">{t("Šifra")}</th>
                <th className="pr-[8px] font-semibold">{t("Komada")}</th>
                <th className="pr-[8px] font-semibold">{t("U ponudi")}</th>
                <th className="font-semibold">{t("Slika")}</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => {
                const current = row(variant.id);
                const label = variantLabel(variant);
                const savedVariant = variantBase && savedIds.includes(variant.id);
                return (
                  <tr key={variant.id} className={current.enabled ? undefined : "opacity-50"}>
                    <td className="pr-[6px]">
                      <input
                        type="checkbox"
                        aria-label={t("Označi: {a}", { a: label })}
                        checked={selected.has(variant.id)}
                        onChange={(event) => {
                          const next = new Set(selected);
                          if (event.target.checked) next.add(variant.id);
                          else next.delete(variant.id);
                          setSelected(next);
                        }}
                        className="size-[18px] accent-ink"
                      />
                    </td>
                    <td className="pr-[10px] font-display text-[14.5px] font-semibold whitespace-nowrap">{label}</td>
                    <td className="pr-[8px]">
                      <input
                        type="number"
                        min="0"
                        step={step}
                        placeholder={t("kao proizvod")}
                        aria-label={`${label}: cena`}
                        value={current.price}
                        onChange={(event) => change(variant.id, { price: event.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="pr-[8px]">
                      <input
                        type="number"
                        min="0"
                        step={step}
                        placeholder={t("nema")}
                        aria-label={`${label}: cena na akciji`}
                        value={current.salePrice}
                        onChange={(event) => change(variant.id, { salePrice: event.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="pr-[8px]">
                      <input
                        maxLength={64}
                        aria-label={t("{a}: šifra", { a: label })}
                        value={current.sku}
                        onChange={(event) => change(variant.id, { sku: event.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="pr-[8px]">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder={t("ne vodi se")}
                        aria-label={`${label}: broj komada`}
                        value={current.stockQty}
                        onChange={(event) => change(variant.id, { stockQty: event.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="pr-[8px] text-center">
                      <input
                        type="checkbox"
                        className="size-[18px] accent-ink"
                        aria-label={`${label}: u ponudi`}
                        checked={current.enabled}
                        onChange={(event) => change(variant.id, { enabled: event.target.checked })}
                      />
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-[8px]">
                        {current.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sizedSrc(current.image, 320)} alt="" className="size-[40px] shrink-0 rounded-[10px] object-cover" />
                        ) : (
                          <span className="flex size-[40px] shrink-0 items-center justify-center rounded-[10px] bg-ph text-[10px] text-muted">{t("glavna")}</span>
                        )}
                        {savedVariant ? (
                          <Link
                            href={`${variantBase}/${variant.id}`}
                            className="rounded-full px-[12px] py-[8px] font-display text-[13.5px] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-colors hover:bg-band"
                          >
                            {t("Uredi")}
                          </Link>
                        ) : (
                          images.length > 0 && (
                            <select
                              aria-label={`${label}: slika`}
                              value={current.image}
                              onChange={(event) => change(variant.id, { image: event.target.value })}
                              className={`${cellInput} w-auto`}
                            >
                              <option value="">{t("glavna slika")}</option>
                              {images.map((src, index) => (
                                <option key={src} value={src}>
                                  {t("slika {a}", { a: index + 1 })}
                                </option>
                              ))}
                            </select>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {variants.length > 0 && (
        <p className="mt-[-4px] text-[14px] text-muted">
          {variantBase
            ? t("Prazna cena znači cenu proizvoda. Akcija uz varijantu važi samo za nju, i bez njene cene. Prazan broj komada znači da se stanje varijante ne vodi. „Uredi\" otvara stranicu varijante: tu joj dodajete sopstvenu sliku. Nove varijante dobijaju stranicu kada sačuvate proizvod.")
            : t("Prazna cena znači cenu proizvoda. Akcija uz varijantu važi samo za nju, i bez njene cene. Prazan broj komada znači da se stanje varijante ne vodi. Posle čuvanja svaka varijanta dobija svoju stranicu, sa sopstvenom slikom.")}
        </p>
      )}
    </>
  );
}
