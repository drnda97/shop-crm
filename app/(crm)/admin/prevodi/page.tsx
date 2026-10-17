import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { langName } from "@/lib/i18n";
import { getPanelT } from "@/lib/i18n/server";
import { TRANSLATION_GROUPS, translationSources, type TranslationGroup } from "@/lib/i18n/sources";
import { getTranslations } from "@/lib/translations";
import { saveTranslationsAction } from "../actions";
import { buttonClass, cardClass, chipClass, chipOffClass, chipOnClass, inputClass, PageHeader, Pager, paginate, quietButtonClass, textLinkClass } from "../ui";

type TranslationsPageProps = { searchParams: Promise<{ jezik?: string; grupa?: string; q?: string; samo?: string; strana?: string; greska?: string; ok?: string }> };

/** Najviše redova na stranici; ostali se nalaze pretragom ili filterom „samo neprevedeno". */

/** Prevodi prodavnice na dodatne jezike: tekstovi teme, sadržaj sajta i katalog. */
export default async function TranslationsPage({ searchParams }: TranslationsPageProps) {
  const t = await getPanelT();
  await requireAdmin("content");
  const [{ jezik, grupa, q = "", samo, strana, greska, ok }, settings] = await Promise.all([searchParams, getSettings()]);
  const { language, languages } = settings.store;

  if (languages.length === 0) {
    return (
      <>
        <PageHeader title={t("Prevodi")} hint={t("Prodavnica može biti na više jezika: kupac bira jezik u zaglavlju sajta, a vi ovde prevodite tekstove.")} />
        <div className={cardClass}>
          <p className="text-[15.5px]">
            {t("Prodavnica za sada ima jedan jezik:")} <strong>{langName(language)}</strong>. {t("Dodatne jezike upišite u")}{" "}
            <Link href="/admin/podesavanja" className={textLinkClass}>
              {t("Podešavanja → Prodavnica → Dodatni jezici sajta")}
            </Link>
            .
          </p>
        </div>
      </>
    );
  }

  const lang = languages.includes(jezik ?? "") ? (jezik as string) : languages[0];
  const group: TranslationGroup = grupa && grupa in TRANSLATION_GROUPS ? (grupa as TranslationGroup) : "sajt";
  const [sources, saved] = await Promise.all([translationSources(group, lang), getTranslations(lang)]);
  const needle = q.trim().toLocaleLowerCase();
  const rows = sources
    .map((row) => ({ ...row, value: saved[row.source] ?? "" }))
    .filter((row) => (samo ? row.value === "" && row.builtIn === "" : true))
    .filter((row) => !needle || `${row.source} ${row.value} ${row.builtIn}`.toLocaleLowerCase().includes(needle));
  const { shown, page, pages } = paginate(rows, strana);
  const missing = sources.filter((row) => !saved[row.source] && row.builtIn === "").length;
  const url = (next: { jezik?: string; grupa?: string; samo?: string }) => {
    const query = new URLSearchParams({ jezik: next.jezik ?? lang, grupa: next.grupa ?? group });
    if ((next.samo ?? samo) === "1") query.set("samo", "1");
    return `/admin/prevodi?${query}`;
  };

  return (
    <>
      <PageHeader
        title={t("Prevodi")}
        hint={t("Levo je tekst na glavnom jeziku, desno prevod. Prazno polje znači da važi ponuđeni prevod (sivo), a ako ga nema, tekst na glavnom jeziku. Tekst koji kasnije promenite na glavnom jeziku traži nov prevod.")}
        error={greska}
        notice={ok}
      />

      <div className="mb-[12px] flex flex-wrap gap-[8px]">
        {languages.map((code) => (
          <Link key={code} href={url({ jezik: code })} className={`${chipClass} ${code === lang ? chipOnClass : chipOffClass}`}>
            {langName(code)}
          </Link>
        ))}
      </div>
      <div className="mb-[16px] flex flex-wrap gap-[8px]">
        {(Object.keys(TRANSLATION_GROUPS) as TranslationGroup[]).map((id) => (
          <Link key={id} href={url({ grupa: id })} className={`${chipClass} ${id === group ? chipOnClass : chipOffClass}`}>
            {t(TRANSLATION_GROUPS[id])}
          </Link>
        ))}
      </div>

      <form method="get" className="mb-[16px] flex flex-wrap items-center gap-[10px]">
        <input type="hidden" name="jezik" value={lang} />
        <input type="hidden" name="grupa" value={group} />
        <input name="q" defaultValue={q} placeholder={t("Pretraga teksta ili prevoda")} className={`${inputClass} max-w-[420px]`} />
        <label className="flex cursor-pointer items-center gap-[8px] text-[15px]">
          <input type="checkbox" name="samo" value="1" defaultChecked={samo === "1"} className="size-[18px] accent-ink" />
          {t("Samo neprevedeno")}
        </label>
        <button type="submit" className={quietButtonClass}>
          {t("Prikaži")}
        </button>
        <span className="text-[14px] text-muted">
          {t("Bez prevoda: {a} od {b}", { a: missing, b: sources.length })}
        </span>
      </form>

      {shown.length === 0 ? (
        <div className={cardClass}>
          <p className="text-[15px] text-muted">{t("Nema tekstova za ovaj izbor.")}</p>
        </div>
      ) : (
        <form action={saveTranslationsAction} className="flex flex-col gap-[10px]">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="back" value={`${url({})}${q ? `&q=${encodeURIComponent(q)}` : ""}${page > 1 ? `&strana=${page}` : ""}`} />
          {shown.map((row, index) => {
            const long = row.source.length > 70 || row.source.includes("\n");
            return (
              <div key={index} className={`${cardClass} grid gap-[12px] !p-[16px] md:grid-cols-2`}>
                <input type="hidden" name="source" value={row.source} />
                <div className="text-[15px] whitespace-pre-wrap text-ink">{row.source}</div>
                {long ? (
                  <textarea name="value" defaultValue={row.value} placeholder={row.builtIn} lang={lang} rows={Math.min(8, Math.ceil(row.source.length / 60) + 1)} className={`${inputClass} min-h-[80px]`} />
                ) : (
                  <input name="value" defaultValue={row.value} placeholder={row.builtIn} lang={lang} className={inputClass} />
                )}
              </div>
            );
          })}
          <p className="text-[14px] text-muted">{t("Čuvaju se prevodi sa ove strane; pre prelaska na sledeću sačuvajte.")}</p>
          <div className="sticky bottom-[16px]">
            <button type="submit" className={buttonClass}>
              {t("Sačuvaj prevode")}
            </button>
          </div>
        </form>
      )}
      {rows.length > 0 && (
        <Pager
          path="/admin/prevodi"
          params={{ jezik: lang, grupa: group, q: q.trim(), samo: samo === "1" ? "1" : "" }}
          page={page}
          pages={pages}
          summary={t("Tekstova: {a}", { a: rows.length })}
        />
      )}
    </>
  );
}
