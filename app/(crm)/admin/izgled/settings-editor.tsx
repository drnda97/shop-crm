"use client";

import { useT } from "@/lib/i18n/client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Field, SectionData } from "@/lib/sections";
import { saveSettingsPartAction, saveSettingsPreviewAction, type SettingsPart } from "../actions";
import { Fields, LinkOptions, type FieldOptions } from "../fields";
import { buttonClass, cardClass } from "../ui";

/** Koji deo podešavanja forma uređuje. */
type Part = { part: "theme" } | { part: "site" } | { part: "template"; id: string };

type SettingsEditorProps = {
  target: Part;
  /** Objašnjenje iznad polja. */
  hint: string;
  fields: Field[];
  value: SectionData;
  /** Stranica sajta na kojoj se izmene vide, sa žetonom za pregled. */
  previewUrl: string;
  options: Omit<FieldOptions, "onUpload">;
};

/**
 * Uređivač izgleda sajta: tema, meni i podnožje, i tekstovi stranica sa stalnim rasporedom.
 * Levo polja, desno pregled sajta koji prati izmene; kupci ih vide tek posle „Sačuvaj".
 */
export function SettingsEditor({ target, hint, fields, value: saved, previewUrl, options }: SettingsEditorProps) {
  const t = useT();
  const [value, setValue] = useState(saved);
  const [media, setMedia] = useState(options.media);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const frame = useRef<HTMLIFrameElement>(null);

  const part = (data: SectionData): SettingsPart => ({ ...target, value: data }) as SettingsPart;

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
    try {
      const view = frame.current?.contentWindow;
      const top = Number(view?.sessionStorage.getItem("preview-scroll"));
      if (view && top > 0) view.scrollTo(0, top);
    } catch {
      // Stranica van sajta; pregled ostaje gde jeste.
    }
  }

  // Pregled čita izmene iz zapisa na serveru. Pri otvaranju se u njega upisuje sačuvano stanje,
  // da ne ostane zapis iz ranijeg uređivanja; tek tada se pregled učitava.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) {
      void saveSettingsPreviewAction(part(value)).then(() => setReady(true));
      return;
    }
    // Izmene idu u pregled sa malim zakašnjenjem, da se ne šalje svako slovo.
    const timer = setTimeout(async () => {
      await saveSettingsPreviewAction(part(value));
      reloadPreview();
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Upozorenje pre zatvaranja kartice sa nesačuvanim izmenama.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function save() {
    startSaving(async () => {
      const result = await saveSettingsPartAction(part(value));
      if (!result.ok) return setMessage({ kind: "error", text: t(result.error) });
      setDirty(false);
      setMessage({ kind: "ok", text: t("Sačuvano. Izmene su na sajtu.") });
      reloadPreview();
    });
  }

  return (
    <>
      <div className="grid items-start gap-[16px] xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <LinkOptions links={options.links} />
        <div className="flex min-w-0 flex-col gap-[16px]">
          <div className={`${cardClass} flex flex-col gap-[16px]`}>
            <p className="text-[14.5px] text-muted">{t(hint)}</p>
            <Fields
              fields={fields}
              value={value}
              onChange={(next) => {
                setValue(next);
                setDirty(true);
                setMessage(null);
              }}
              options={{ ...options, media, onUpload: (src) => setMedia((current) => [src, ...current]) }}
            />
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
          <iframe ref={frame} src={ready ? previewUrl : undefined} title={t("Pregled sajta")} className="w-full grow border-0" onLoad={onPreviewLoad} />
        </div>
      </div>
    </>
  );
}
