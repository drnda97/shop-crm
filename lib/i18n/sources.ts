import { getCategories, getCollections, getPages, getProducts, getSettings } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { contentMap } from "@/lib/i18n/content";
import { shopDict } from "@/lib/i18n/shop";
import { collectTexts } from "@/lib/i18n/walk";
import { themeDict } from "@theme/i18n";

/**
 * Šta se u prodavnici može prevesti, po grupama, za stranicu Prevodi u panelu. Samo za server.
 */

export const TRANSLATION_GROUPS = {
  tema: "Tekstovi teme i poruke kupcu",
  sajt: "Meni, podnožje, stranice, dostava i email",
  katalog: "Proizvodi, kategorije i kolekcije",
} as const;

export type TranslationGroup = keyof typeof TRANSLATION_GROUPS;

export type TranslationSource = {
  source: string;
  /** Prevod iz rečnika u kodu, koji važi dok vlasnik ne upiše svoj; prazno kada ga nema. */
  builtIn: string;
};

/** Izvorni tekstovi grupe, sa prevodom iz koda za dati jezik kada postoji. */
export async function translationSources(group: TranslationGroup, lang: Lang): Promise<TranslationSource[]> {
  const settings = await getSettings();
  const main = settings.store.language;

  if (group === "tema") {
    // Tekstovi teme i jezgra su u kodu na srpskom; jezik bez rečnika pada na engleski.
    const english = { ...shopDict.en, ...themeDict.en };
    const own = { ...shopDict[lang], ...themeDict[lang] };
    return Object.keys(english)
      .filter((source) => source !== "sr")
      .sort((a, b) => a.localeCompare(b, "sr"))
      .map((source) => ({ source, builtIn: lang === "sr" ? source : (own[source] ?? english[source] ?? "") }));
  }

  const texts = new Set<string>();
  if (group === "sajt") {
    const { site, templates, shipping, abandoned, mail } = settings;
    collectTexts({ site, templates }, texts);
    collectTexts(shipping.methods.map(({ name, hint, confirmation }) => ({ name, hint, confirmation })), texts);
    collectTexts({ subject: abandoned.subject, text: abandoned.text }, texts);
    collectTexts(Object.values(mail.statusEmails).map(({ subject, text }) => ({ subject, text })), texts);
    for (const page of await getPages()) collectTexts({ title: page.title, seoTitle: page.seoTitle, seoDescription: page.seoDescription, sections: page.sections }, texts);
  } else {
    const [products, categories, collections] = await Promise.all([getProducts(), getCategories(), getCollections()]);
    collectTexts(categories.map(({ label, description, seoTitle, seoDescription }) => ({ label, description, seoTitle, seoDescription })), texts);
    collectTexts(collections.map(({ name, description }) => ({ name, description })), texts);
    for (const product of products) {
      const { name, summary, description, seoTitle, seoDescription, attributes, options, highlight } = product;
      collectTexts({ name, summary, description, seoTitle, seoDescription, attributes, highlight }, texts);
      collectTexts(options.map((option) => ({ name: option.name, values: option.values.map((value) => value.label) })), texts);
    }
  }
  const builtIn = contentMap(main, lang);
  return [...texts].map((source) => ({ source, builtIn: builtIn.get(source) ?? "" }));
}
