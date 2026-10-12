"use client";

import { useT } from "@/lib/i18n/client";
import { useEffect, useRef, useState, useTransition } from "react";
import { newSection, sectionType, SECTION_TYPES, type Section } from "@/lib/sections";
import { savePageAction, savePreviewAction } from "../../actions";
import { Fields, LinkOptions, type FieldOptions } from "../../fields";
import { buttonClass, cardClass, inputClass, labelClass, panelTitleClass, quietButtonClass } from "../../ui";

type EditorPage = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
  showInFooter: boolean;
  sections: Section[];
};

type PageEditorProps = {
  page: EditorPage;
  /** Početna je uvek objavljena. */
  isHome: boolean;
  /** Adresa stranice na sajtu, sa žetonom za pregled nesačuvanih izmena. */
  previewUrl: string;
  options: Omit<FieldOptions, "onUpload">;
};

const smallButton =
  "flex size-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full font-display text-[15px] font-bold transition-colors duration-300 hover:bg-band hover:text-ink disabled:cursor-default disabled:opacity-30";

/** Prvi upisan tekst sekcije, da se u spisku razlikuju dve sekcije iste vrste. */
function summary(section: Section): string {
  for (const key of ["heading", "title"]) {
    const value = section.data[key];
    if (typeof value === "string" && value.trim()) return value.trim().split("\n")[0].slice(0, 50);
  }
  return "";
}

/**
 * Uređivač stranice: levo sekcije i njihova polja, desno pregled sajta. Pregled prati
 * izmene dok se kuca; kupci ih vide tek posle „Sačuvaj".
 */
export function PageEditor({ page, isHome, previewUrl, options }: PageEditorProps) {
  const t = useT();
  const [sections, setSections] = useState(page.sections);
  const [meta, setMeta] = useState({
    title: page.title,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    published: page.published,
    showInFooter: page.showInFooter,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [media, setMedia] = useState(options.media);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const frame = useRef<HTMLIFrameElement>(null);
  // Sekcija na koju pregled treba da se pomeri kada se ponovo učita.
  const focus = useRef<string | null>(null);

  function reloadPreview() {
    const view = frame.current?.contentWindow;
    if (!view) return;
    try {
      view.sessionStorage.setItem("preview-scroll", String(view.scrollY));
      view.location.reload();
    } catch {
      // Pregled je u međuvremenu otišao na drugu adresu (klik na link): vraća se na stranicu.
      frame.current!.src = previewUrl;
    }
  }

  function onPreviewLoad() {
    const view = frame.current?.contentWindow;
    if (!view) return;
    try {
      const target = focus.current && view.document.querySelector(`[data-section="${focus.current}"]`)?.firstElementChild;
      focus.current = null;
      if (target) return target.scrollIntoView({ block: "start" });
      const saved = Number(view.sessionStorage.getItem("preview-scroll"));
      if (saved > 0) view.scrollTo(0, saved);
    } catch {
      // Stranica van sajta; pregled ostaje gde jeste.
    }
  }

  // Pregled čita izmene iz zapisa na serveru. Pri otvaranju se u njega upisuje sačuvano stanje,
  // da ne ostane zapis iz ranijeg uređivanja koje nije sačuvano; tek tada se pregled učitava.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) {
      void savePreviewAction(page.slug, sections).then(() => setReady(true));
      return;
    }
    // Izmene idu u pregled sa malim zakašnjenjem, da se ne šalje svako slovo.
    const timer = setTimeout(async () => {
      await savePreviewAction(page.slug, sections);
      reloadPreview();
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  // Upozorenje pre zatvaranja kartice sa nesačuvanim izmenama.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(next: Section[]) {
    setSections(next);
    setDirty(true);
    setMessage(null);
  }

  function changeMeta(next: Partial<typeof meta>) {
    setMeta({ ...meta, ...next });
    setDirty(true);
    setMessage(null);
  }

  function move(index: number, by: number) {
    const next = [...sections];
    const [section] = next.splice(index, 1);
    next.splice(index + by, 0, section);
    focus.current = section.id;
    change(next);
  }

  function add(type: string) {
    const section = newSection(type, sections.map((item) => item.id));
    if (!section) return;
    focus.current = section.id;
    change([...sections, section]);
    setSelected(section.id);
    setAdding(false);
  }

  function select(id: string) {
    const next = selected === id ? null : id;
    setSelected(next);
    // Pregled se pomera na sekciju koja se uređuje.
    try {
      const target = next && frame.current?.contentWindow?.document.querySelector(`[data-section="${next}"]`)?.firstElementChild;
      if (target) target.scrollIntoView({ block: "start", behavior: "smooth" });
    } catch {
      // Pregled je na drugoj adresi.
    }
  }

  function save() {
    startSaving(async () => {
      const result = await savePageAction({ slug: page.slug, ...meta, sections });
      if (!result.ok) return setMessage({ kind: "error", text: t(result.error) });
      setDirty(false);
      setMessage({ kind: "ok", text: meta.published || isHome ? t("Sačuvano. Izmene su na sajtu.") : t("Sačuvano kao nacrt.") });
      reloadPreview();
    });
  }

  const fieldOptions: FieldOptions = {
    ...options,
    media,
    onUpload: (src) => setMedia((current) => [src, ...current]),
  };

  return (
    <div className="grid items-start gap-[16px] xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
      <LinkOptions links={options.links} />

      <div className="flex min-w-0 flex-col gap-[16px]">
        <div className={`${cardClass} flex flex-col gap-[8px]`}>
          <h2 className={panelTitleClass}>{t("Sekcije")}</h2>
          <p className="mb-[4px] text-[14px] text-muted">
            {t("Na sajtu idu ovim redom. Kliknite na sekciju da izmenite njen sadržaj.")}
          </p>

          {sections.map((section, index) => {
            const definition = sectionType(section.type);
            if (!definition) return null;
            const isOpen = selected === section.id;
            const title = summary(section);
            return (
              <div key={section.id} className={`rounded-[20px] border-[1.5px] ${isOpen ? "border-ink" : "border-line"}`}>
                <div className="flex items-center gap-[2px] py-[5px] pr-[6px] pl-[16px]">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    className="min-h-[44px] min-w-0 grow cursor-pointer truncate text-left font-display text-[15.5px] font-bold"
                    onClick={() => select(section.id)}
                  >
                    {t(definition.label)}
                    {title && <span className="font-sans text-[14.5px] font-normal text-muted"> · {title}</span>}
                  </button>
                  <button type="button" className={smallButton} aria-label={t("Pomeri gore")} disabled={index === 0} onClick={() => move(index, -1)}>
                    ↑
                  </button>
                  <button type="button" className={smallButton} aria-label={t("Pomeri dole")} disabled={index === sections.length - 1} onClick={() => move(index, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className={smallButton}
                    aria-label={t("Ukloni sekciju: {a}", { a: t(definition.label) })}
                    onClick={() => {
                      if (!window.confirm(t("Ukloniti sekciju „{a}”?", { a: t(definition.label) }))) return;
                      change(sections.filter((item) => item.id !== section.id));
                      setSelected(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                {isOpen && (
                  <div className="border-t border-line p-[16px]">
                    <Fields
                      fields={definition.fields}
                      value={section.data}
                      onChange={(data) => change(sections.map((item) => (item.id === section.id ? { ...item, data } : item)))}
                      options={fieldOptions}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {sections.length === 0 && <p className="py-[8px] text-[15px] text-muted">{t("Stranica još nema sekcija.")}</p>}

          <div className="mt-[6px]">
            <button type="button" className={quietButtonClass} aria-expanded={adding} onClick={() => setAdding(!adding)}>
              {t("+ Dodaj sekciju")}
            </button>
          </div>
          {adding && (
            <div className="grid gap-[6px] rounded-[20px] bg-band p-[8px]">
              {SECTION_TYPES.map((type) => (
                <button
                  type="button"
                  key={type.type}
                  className="cursor-pointer rounded-[14px] bg-white px-[14px] py-[10px] text-left transition-shadow duration-300 hover:shadow-soft"
                  onClick={() => add(type.type)}
                >
                  <span className="block font-display text-[15px] font-bold">{t(type.label)}</span>
                  <span className="block text-[13.5px] text-muted">{t(type.hint)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`${cardClass} flex flex-col gap-[16px]`}>
          <h2 className={panelTitleClass}>{t("Stranica")}</h2>
          <label className={labelClass}>
            {t("Naziv stranice *")}
            <input className={inputClass} value={meta.title} onChange={(event) => changeMeta({ title: event.target.value })} />
          </label>
          <label className={labelClass}>
            {t("Naslov za pretraživače")}
            <input
              className={inputClass}
              placeholder={meta.title}
              value={meta.seoTitle}
              onChange={(event) => changeMeta({ seoTitle: event.target.value })}
            />
            <span className="font-sans text-[13.5px] font-normal text-muted">
              {t("Vidi se u kartici pregledača i u rezultatima pretrage. Prazno: naziv stranice.")}
            </span>
          </label>
          <label className={labelClass}>
            {t("Opis za pretraživače")}
            <textarea
              className={`${inputClass} min-h-[90px]`}
              maxLength={500}
              value={meta.seoDescription}
              onChange={(event) => changeMeta({ seoDescription: event.target.value })}
            />
            <span className="font-sans text-[13.5px] font-normal text-muted">
              {t("Jedna do dve rečenice, do oko 160 znakova. Prazno: opis prodavnice iz Izgleda sajta.")}
            </span>
          </label>
          {!isHome && (
            <label className="flex cursor-pointer items-center gap-[10px] text-[15px]">
              <input type="checkbox" className="size-[20px] accent-ink" checked={meta.published} onChange={(event) => changeMeta({ published: event.target.checked })} />
              {t("Objavljena — vidi se na sajtu")}
            </label>
          )}
          <label className="flex cursor-pointer items-center gap-[10px] text-[15px]">
            <input type="checkbox" className="size-[20px] accent-ink" checked={meta.showInFooter} onChange={(event) => changeMeta({ showInFooter: event.target.checked })} />
            {t("API je vraća u spisku „footerPages”")}
          </label>
        </div>

        <div className="sticky bottom-[12px] z-10 flex flex-wrap items-center gap-[14px] rounded-full bg-white py-[8px] pr-[20px] pl-[8px] shadow-lift">
          <button type="button" className={buttonClass} disabled={saving || !dirty} onClick={save}>
            {saving ? t("Čuvam…") : t("Sačuvaj")}
          </button>
          <span role="status" className="text-[14.5px] font-medium">
            {message ? message.text : dirty ? t("Imate nesačuvane izmene.") : t("Sve je sačuvano.")}
          </span>
        </div>
      </div>

      <div className="sticky top-[12px] flex h-[calc(100vh-24px)] min-h-[480px] flex-col overflow-hidden rounded-[26px] bg-white shadow-soft max-xl:hidden">
        <div className="flex items-center justify-between gap-[12px] border-b border-line px-[18px] py-[10px]">
          <span className="font-display text-[14px] font-bold">{t("Pregled")}</span>
          <span className="text-[13.5px] text-muted">{dirty ? t("prikazuje nesačuvane izmene") : t("kao na sajtu")}</span>
        </div>
        <iframe ref={frame} src={ready ? previewUrl : undefined} title={t("Pregled stranice")} className="w-full grow border-0" onLoad={onPreviewLoad} />
      </div>
    </div>
  );
}
