import { headers } from "next/headers";
import { cache } from "react";
import { isPreviewToken } from "@/lib/admin-auth";
import type { Page } from "@/lib/catalog";
import { getPages, getSettings, getStoredValue } from "@/lib/content";
import { normalizeSections, type Section } from "@/lib/sections";
import { mergeSettings, type Settings } from "@/lib/settings";
import { PREVIEW_HEADER } from "@/lib/storefront/preview-names";
import type { Templates } from "@/lib/templates";

/**
 * Šta javna prodavnica prikazuje: sačuvan sadržaj, ili — u pregledu iz panela — izmene koje
 * vlasnik još nije sačuvao. Samo za server.
 *
 * Pregled: uređivač u panelu učitava sajt u okviru sa žetonom u adresi (?pregled=…). proxy.ts
 * ga prenosi u zaglavlje zahteva, pa ga vide i layout i podnožje, koji adresu ne čitaju.
 */

/** Ime zapisa u tabeli settings sa nesačuvanim izmenama iz uređivača koji je trenutno otvoren. */
export const PREVIEW_KEY = "preview";

/** Nesačuvane izmene: jedna stranica, ili jedan deo podešavanja sajta. */
export type PreviewDraft =
  | { kind: "page"; slug: string; sections: Section[] }
  | { kind: "settings"; settings: SettingsDraft };

/** Deo podešavanja koji se uređuje u Izgledu sajta; od šablona samo onaj koji je otvoren. */
export type SettingsDraft = Partial<Pick<Settings, "colors" | "fonts" | "site">> & {
  templates?: Partial<Templates>;
};

const getDraft = cache(async (): Promise<PreviewDraft | null> => {
  const token = (await headers()).get(PREVIEW_HEADER) ?? undefined;
  if (!isPreviewToken(token)) return null;
  try {
    return JSON.parse((await getStoredValue(PREVIEW_KEY)) ?? "null") as PreviewDraft | null;
  } catch {
    return null;
  }
});

/** Da li je zahtev pregled iz panela (ispravan žeton). */
export async function inPreview(): Promise<boolean> {
  return isPreviewToken((await headers()).get(PREVIEW_HEADER) ?? undefined);
}

/** Podešavanja za prikaz sajta; u pregledu sa nesačuvanim izmenama teme, menija ili tekstova. */
export const getShopSettings = cache(async (): Promise<Settings> => {
  const [settings, draft] = await Promise.all([getSettings(), getDraft()]);
  if (draft?.kind !== "settings") return settings;
  const { colors, fonts, site, templates } = draft.settings;
  return mergeSettings({
    ...settings,
    ...(colors ? { colors } : {}),
    ...(fonts ? { fonts } : {}),
    ...(site ? { site } : {}),
    ...(templates ? { templates: { ...settings.templates, ...templates } } : {}),
  });
});

/**
 * Stranica za prikaz. U pregledu vraća nesačuvane izmene, i kada je stranica nacrt;
 * inače samo objavljenu stranicu.
 */
export async function getSitePage(slug: string): Promise<Page | null> {
  const page = (await getPages()).find((candidate) => candidate.slug === slug);
  if (!page) return null;
  if (await inPreview()) {
    const draft = await getDraft();
    return draft?.kind === "page" && draft.slug === slug
      ? { ...page, sections: normalizeSections(draft.sections) }
      : page;
  }
  return page.published ? page : null;
}

/** Javna adresa sajta, bez kose crte na kraju: PUBLIC_URL, ili adresa sa koje je stigao zahtev. */
export async function siteUrl(): Promise<string> {
  const configured = process.env.PUBLIC_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost";
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
