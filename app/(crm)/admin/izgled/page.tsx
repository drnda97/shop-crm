import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { listThemes, type ThemePackage } from "@/lib/theme-packages";
import { THEME_LIST } from "@/themes/list";
import { ConfirmButton } from "../confirm-button";
import { addCodeThemeAction, deleteThemeAction, duplicateThemeAction, importThemeAction, publishThemeAction, renameThemeAction } from "../theme-actions";
import { buttonClass, cardClass, fileClass, inputClass, PageHeader, panelTitleClass, quietButtonClass, textLinkClass } from "../ui";

type ThemesPageProps = { searchParams: Promise<{ greska?: string; ok?: string }> };

const small =
  "inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-full px-[16px] font-display text-[13.5px] font-bold whitespace-nowrap text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-colors duration-300 hover:bg-band hover:text-ink";

/** Mali prikaz teme: njene četiri boje, kao na kartici teme u Shopify-ju. */
function Swatch({ theme, large = false }: { theme: ThemePackage; large?: boolean }) {
  const { background, surface, text, accent } = theme.design.colors;
  return (
    <div
      aria-hidden
      className={`flex shrink-0 flex-col justify-between overflow-hidden rounded-[18px] p-[14px] shadow-[inset_0_0_0_1px_var(--color-line)] ${large ? "h-[160px] w-full sm:w-[240px]" : "h-[110px] w-full"}`}
      style={{ background }}
    >
      <div className="flex items-center gap-[6px]">
        <span className="h-[8px] w-[34%] rounded-full" style={{ background: text }} />
        <span className="ml-auto h-[8px] w-[18%] rounded-full" style={{ background: accent }} />
      </div>
      <div className="flex flex-col gap-[6px]">
        <span className="h-[10px] w-[62%] rounded-full" style={{ background: text }} />
        <span className="h-[26px] w-full rounded-[10px]" style={{ background: surface }} />
        <span className="h-[18px] w-[38%] rounded-full" style={{ background: accent }} />
      </div>
    </div>
  );
}

/**
 * Teme, kao Online Store → Themes u Shopify-ju: aktivna tema, biblioteka sa ostalim temama,
 * ubacivanje teme (.zip) i teme iz koda na kojima se teme prave. „Prilagodi" otvara Boje i
 * fontovi, Zaglavlje, Podnožje i tekstove stalnih stranica aktivne teme.
 */
export default async function ThemesPage({ searchParams }: ThemesPageProps) {
  const t = await getPanelT();
  await requireAdmin("content");
  const [{ greska, ok }, library, settings] = await Promise.all([searchParams, listThemes(), getSettings()]);
  const date = new Intl.DateTimeFormat(settings.store.locale, { dateStyle: "medium", timeZone: settings.store.timeZone });
  const active = library.items.find((item) => item.id === library.active)!;
  const others = library.items.filter((item) => item.id !== library.active);
  const baseName = (id: string) => THEME_LIST.find((theme) => theme.id === id)?.name ?? id;

  const rename = (theme: ThemePackage) => (
    <details className="w-full">
      <summary className={`${textLinkClass} cursor-pointer list-none`}>{t("Preimenuj")}</summary>
      <form action={renameThemeAction} className="mt-[8px] flex gap-[8px]">
        <input type="hidden" name="id" value={theme.id} />
        <input name="name" required maxLength={80} defaultValue={theme.name} aria-label={t("Naziv teme")} className={`${inputClass} !min-h-[40px]`} />
        <button type="submit" className={small}>
          {t("Sačuvaj")}
        </button>
      </form>
    </details>
  );

  const copyAndDownload = (theme: ThemePackage) => (
    <>
      <form action={duplicateThemeAction}>
        <input type="hidden" name="id" value={theme.id} />
        <button type="submit" className={small}>
          {t("Dupliraj")}
        </button>
      </form>
      <a href={`${ADMIN_PATH}/izgled/preuzmi?tema=${theme.id}`} className={small}>
        {t("Preuzmi .zip")}
      </a>
    </>
  );

  return (
    <>
      <PageHeader
        title={t("Teme")}
        hint={t("Tema je izgled sajta: boje, fontovi, sopstveni CSS, zaglavlje, podnožje i tekstovi stalnih stranica. Stranice, proizvodi i logo su isti u svakoj temi. Kupci vide samo aktivnu temu; ostale možete da pregledate na sajtu pre objave. Menja se aktivna tema (Prilagodi): da biste probali drugačiji izgled, duplirajte je, objavite kopiju i menjajte nju.")}
        error={greska}
        notice={ok}
      />

      <section className={`${cardClass} mb-[24px] flex flex-col gap-[20px] sm:flex-row`}>
        <Swatch theme={active} large />
        <div className="flex min-w-0 grow flex-col gap-[10px]">
          <span className="eyebrow">{t("Aktivna tema")}</span>
          <h2 className="text-[26px] leading-[1.15]">{active.name}</h2>
          <p className="text-[14.5px] text-muted">
            {t("Na temi iz koda: {a}", { a: baseName(active.base) })}
            {active.design.customCss && ` · ${t("ima sopstveni CSS")}`}
          </p>
          <div className="mt-auto flex flex-wrap gap-[8px]">
            <Link href={`${ADMIN_PATH}/izgled/boje`} className={buttonClass}>
              {t("Prilagodi")}
            </Link>
            <a href="/" target="_blank" rel="noreferrer" className={quietButtonClass}>
              {t("Pogledaj sajt")}
            </a>
            {copyAndDownload(active)}
          </div>
          {rename(active)}
        </div>
      </section>

      <h2 className="mb-[12px] text-[22px]">
        {t("Biblioteka tema")} <span className="font-sans text-[16px] font-normal text-muted">({others.length})</span>
      </h2>
      {others.length === 0 ? (
        <p className={`${cardClass} mb-[24px] text-[15px] text-muted`}>
          {t("Biblioteka je prazna. Dodajte temu ispod, ili duplirajte aktivnu da biste u kopiji probali drugačiji izgled.")}
        </p>
      ) : (
        <div className="mb-[24px] grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-[16px]">
          {others.map((theme) => (
            <article key={theme.id} className={`${cardClass} flex flex-col gap-[12px] !p-[16px]`}>
              <Swatch theme={theme} />
              <div>
                <h3 className="text-[18px]">{theme.name}</h3>
                <p className="text-[13.5px] text-muted">
                  {baseName(theme.base)} · {t("izmenjena {a}", { a: date.format(new Date(theme.updatedAt)) })}
                </p>
              </div>
              <div className="flex flex-wrap gap-[6px]">
                <form action={publishThemeAction}>
                  <input type="hidden" name="id" value={theme.id} />
                  <input type="hidden" name="name" value={theme.name} />
                  <ConfirmButton
                    question={t("Objaviti temu „{a}\"? Kupci odmah vide novi izgled; dosadašnja tema ostaje u biblioteci.", { a: theme.name })}
                    tone="default"
                    confirmLabel={t("Objavi")}
                    className={`${buttonClass} !min-h-[40px] !px-[18px] !text-[13.5px]`}
                  >
                    {t("Objavi")}
                  </ConfirmButton>
                </form>
                <a href={`${ADMIN_PATH}/izgled/pregled?tema=${theme.id}`} target="_blank" rel="noreferrer" className={small}>
                  {t("Pregledaj")}
                </a>
                {copyAndDownload(theme)}
                <form action={deleteThemeAction}>
                  <input type="hidden" name="id" value={theme.id} />
                  <input type="hidden" name="name" value={theme.name} />
                  <ConfirmButton question={t("Obrisati temu „{a}\"?", { a: theme.name })} className={small}>
                    {t("Obriši")}
                  </ConfirmButton>
                </form>
              </div>
              {rename(theme)}
            </article>
          ))}
        </div>
      )}

      <h2 className="mb-[12px] text-[22px]">{t("Dodaj temu")}</h2>
      <div className="grid items-start gap-[16px] xl:grid-cols-2">
        <form action={importThemeAction} className={`${cardClass} flex flex-col gap-[12px]`}>
          <h3 className={panelTitleClass}>{t("Ubaci temu (.zip)")}</h3>
          <p className="text-[14.5px] text-muted">
            {t("Tema preuzeta iz ovog panela (Preuzmi .zip), sa drugog sajta ili od dizajnera. Ulazi u biblioteku; objavljujete je kada je pregledate.")}
          </p>
          <input type="file" name="file" accept=".zip,application/zip" required aria-label={t("Fajl teme")} className={fileClass} />
          <div>
            <button type="submit" className={buttonClass}>
              {t("Ubaci temu")}
            </button>
          </div>
        </form>
        <div className={`${cardClass} flex flex-col gap-[12px]`}>
          <h3 className={panelTitleClass}>{t("Teme iz koda")}</h3>
          <p className="text-[14.5px] text-muted">
            {t("Raspored stranica i komponente dolaze iz teme u kodu. Svaka tema iz biblioteke je na jednoj od njih; nova tema na njoj kreće od njenih boja i fontova.")}
          </p>
          {THEME_LIST.map((theme) => (
            <div key={theme.id} className="flex flex-wrap items-center gap-[12px] rounded-[18px] bg-band p-[12px]">
              <div className="min-w-0 grow">
                <div className="font-display font-bold">{theme.name}</div>
                <div className="text-[13.5px] text-muted">{t(theme.description)}</div>
              </div>
              <form action={addCodeThemeAction}>
                <input type="hidden" name="base" value={theme.id} />
                <button type="submit" className={small}>
                  {t("Dodaj u biblioteku")}
                </button>
              </form>
            </div>
          ))}
          <p className="text-[13.5px] text-muted">
            {t("Nova tema iz koda je za programere: folder u themes/, upis u themes/list.ts i themes/registry.ts, pa build. Uputstvo je u themes/README.md.")}
          </p>
        </div>
      </div>
    </>
  );
}
