import { existsSync, readFileSync } from "node:fs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { slugify } from "@/lib/catalog";
import { getSettings, getStoredValue, saveImage, setStoredValue, updateContent, uploadPath } from "@/lib/content";
import { detectImage } from "@/lib/images";
import { mergeSettings, type Settings } from "@/lib/settings";
import { defaultColors, defaultFonts } from "@/lib/theme";
import { THEME_LIST, themeId, type ThemeId } from "@/themes/list";

/**
 * Teme kao u Shopify-ju: biblioteka tema, jedna aktivna. Tema je paket izgleda nad jednom od
 * tema iz koda (themes/, „osnova"): boje, fontovi, sopstveni CSS, zaglavlje, podnožje i
 * tekstovi stalnih stranica. Stranice od sekcija, proizvodi i logo su sadržaj prodavnice i ne
 * zavise od teme.
 *
 * Aktivna tema živi u podešavanjima (tamo je menja Izgled sajta); biblioteka čuva njen snimak
 * i ostale teme. Pri objavi druge teme snimak aktivne se osvežava, pa se ništa ne gubi.
 * Paket se preuzima i ubacuje kao .zip: theme.json, style.css i slike. Kod se nikad ne ubacuje.
 * Samo za server.
 */

export type ThemeDesign = Pick<Settings, "colors" | "fonts" | "site" | "templates" | "customCss">;

export type ThemePackage = {
  id: string;
  name: string;
  /** Tema iz koda na kojoj je paket. */
  base: ThemeId;
  updatedAt: string;
  design: ThemeDesign;
};

export type ThemeLibrary = { active: string; items: ThemePackage[] };

const KEY = "themes";
const FORMAT = "shopcrm-theme";
/** Najveći .zip teme; slike u njemu su obično najveći deo. */
export const MAX_THEME_ZIP = 15 * 1024 * 1024;
const MEDIA_SRC = /^\/media\/[a-z0-9-]+\.(webp|jpg|jpeg|png|svg)$/;

export function designOf(settings: Settings): ThemeDesign {
  const { colors, fonts, site, templates, customCss } = settings;
  return structuredClone({ colors, fonts, site, templates, customCss });
}

/** Paket iz zapisa (ili iz fajla), sveden na ispravne vrednosti. */
function normalizeDesign(value: unknown): ThemeDesign {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Partial<Settings>;
  return designOf(mergeSettings({ colors: raw.colors, fonts: raw.fonts, site: raw.site, templates: raw.templates, customCss: raw.customCss }));
}

function freeId(name: string, items: ThemePackage[]): string {
  const base = slugify(name).slice(0, 60) || "tema";
  let id = base;
  for (let n = 2; items.some((item) => item.id === id); n++) id = `${base}-${n}`;
  return id;
}

const baseName = (id: ThemeId) => THEME_LIST.find((theme) => theme.id === id)?.name ?? id;

/** Biblioteka; pri prvom otvaranju nastaje od izgleda koji sajt već ima. */
export async function getThemeLibrary(): Promise<ThemeLibrary> {
  let stored: Partial<ThemeLibrary> | null = null;
  try {
    stored = JSON.parse((await getStoredValue(KEY)) ?? "null");
  } catch {
    stored = null;
  }
  const items = (Array.isArray(stored?.items) ? stored.items : [])
    .filter((item): item is ThemePackage => typeof item?.id === "string" && typeof item?.name === "string")
    .map((item) => ({ ...item, base: themeId(item.base), design: normalizeDesign(item.design) }));
  if (items.length > 0 && items.some((item) => item.id === stored?.active)) return { active: stored!.active!, items };

  const settings = await getSettings();
  const first: ThemePackage = {
    id: "osnovna",
    name: baseName(themeId(settings.themeId)),
    base: themeId(settings.themeId),
    updatedAt: new Date().toISOString(),
    design: designOf(settings),
  };
  const library = { active: items[0]?.id ?? first.id, items: items.length > 0 ? items : [first] };
  await setStoredValue(KEY, JSON.stringify(library));
  return library;
}

async function saveLibrary(library: ThemeLibrary) {
  await setStoredValue(KEY, JSON.stringify(library));
}

/** Aktivna tema sa izgledom koji sajt trenutno ima (izmene iz Izgleda sajta su u podešavanjima). */
function withLive(library: ThemeLibrary, settings: Settings): ThemePackage[] {
  return library.items.map((item) =>
    item.id === library.active ? { ...item, base: themeId(settings.themeId), design: designOf(settings) } : item,
  );
}

export async function listThemes(): Promise<ThemeLibrary> {
  const [library, settings] = await Promise.all([getThemeLibrary(), getSettings()]);
  return { ...library, items: withLive(library, settings) };
}

/** Objavljuje temu: njen izgled postaje izgled sajta, a dosadašnja aktivna se čuva u biblioteci. */
export async function publishTheme(id: string): Promise<boolean> {
  const library = await getThemeLibrary();
  const target = library.items.find((item) => item.id === id);
  if (!target || id === library.active) return false;
  let items = library.items;
  await updateContent((content) => {
    items = withLive(library, content.settings);
    Object.assign(content.settings, structuredClone(target.design), { themeId: target.base });
  });
  await saveLibrary({ active: id, items });
  return true;
}

export async function duplicateTheme(id: string): Promise<ThemePackage | null> {
  const [library, settings] = await Promise.all([getThemeLibrary(), getSettings()]);
  const source = withLive(library, settings).find((item) => item.id === id);
  if (!source) return null;
  const name = `${source.name} (kopija)`.slice(0, 80);
  const copy = { ...structuredClone(source), id: freeId(name, library.items), name, updatedAt: new Date().toISOString() };
  await saveLibrary({ ...library, items: [...library.items, copy] });
  return copy;
}

export async function renameTheme(id: string, name: string): Promise<boolean> {
  const library = await getThemeLibrary();
  const clean = name.trim().slice(0, 80);
  if (!clean || !library.items.some((item) => item.id === id)) return false;
  await saveLibrary({ ...library, items: library.items.map((item) => (item.id === id ? { ...item, name: clean } : item)) });
  return true;
}

/** Briše temu iz biblioteke; aktivna i jedina tema se ne brišu. */
export async function deleteTheme(id: string): Promise<boolean> {
  const library = await getThemeLibrary();
  if (id === library.active || library.items.length <= 1 || !library.items.some((item) => item.id === id)) return false;
  await saveLibrary({ ...library, items: library.items.filter((item) => item.id !== id) });
  return true;
}

/** Nova tema na temi iz koda: njene početne boje i fontovi, a zaglavlje, podnožje i tekstovi sajta ostaju. */
export async function addCodeTheme(base: string): Promise<ThemePackage | null> {
  const theme = THEME_LIST.find((item) => item.id === base);
  if (!theme) return null;
  const [library, settings] = await Promise.all([getThemeLibrary(), getSettings()]);
  const item: ThemePackage = {
    id: freeId(theme.name, library.items),
    name: theme.name,
    base: theme.id,
    updatedAt: new Date().toISOString(),
    design: { ...designOf(settings), colors: defaultColors, fonts: defaultFonts, customCss: "" },
  };
  await saveLibrary({ ...library, items: [...library.items, item] });
  return item;
}

/** Izgled teme za pregled na sajtu pre objave (?pregled=…). */
export async function themePreview(id: string) {
  const library = await listThemes();
  const item = library.items.find((candidate) => candidate.id === id);
  return item ? { ...item.design, themeId: item.base } : null;
}

/** Sve adrese slika iz biblioteke (/media/…) koje izgled koristi. */
function mediaIn(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === "string" && MEDIA_SRC.test(value)) into.add(value);
  else if (Array.isArray(value)) for (const item of value) mediaIn(item, into);
  else if (typeof value === "object" && value !== null) for (const item of Object.values(value)) mediaIn(item, into);
  return into;
}

/** Zamenjuje adrese slika po mapi; adresa koje nema u mapi postaje prazna. */
function remapMedia<T>(value: T, map: Map<string, string>): T {
  if (typeof value === "string") return (MEDIA_SRC.test(value) ? (map.get(value) ?? "") : value) as T;
  if (Array.isArray(value)) return value.map((item) => remapMedia(item, map)) as T;
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapMedia(item, map)])) as T;
  }
  return value;
}

/** Tema kao .zip: theme.json (bez CSS-a), style.css i slike koje izgled koristi. */
export async function exportTheme(id: string): Promise<{ name: string; bytes: Uint8Array } | null> {
  const library = await listThemes();
  const item = library.items.find((candidate) => candidate.id === id);
  if (!item) return null;
  const { customCss, ...design } = item.design;
  const files: Record<string, Uint8Array> = {};
  for (const src of mediaIn(design)) {
    const file = uploadPath(src);
    if (file && existsSync(file)) files[`images/${src.slice("/media/".length)}`] = readFileSync(file);
  }
  files["theme.json"] = strToU8(JSON.stringify({ format: FORMAT, version: 1, name: item.name, base: item.base, ...design }, null, 2));
  files["style.css"] = strToU8(customCss);
  return { name: `${item.id}.zip`, bytes: zipSync(files) };
}

export type ImportResult = { ok: true; theme: ThemePackage; notes: string[] } | { ok: false; error: string };

/**
 * Ubacuje temu iz .zip-a u biblioteku (ne objavljuje je). Iz fajla se uzimaju samo podaci
 * izgleda, provereni kao i u panelu; slike se ubacuju u biblioteku slika iznova.
 */
export async function importTheme(bytes: Uint8Array, fileName: string): Promise<ImportResult> {
  if (bytes.length > MAX_THEME_ZIP) return { ok: false, error: "Tema je veća od 15 MB." };
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { ok: false, error: "Fajl nije .zip teme." };
  }
  // Paket može biti spakovan zajedno sa folderom: theme.json je tada u njemu.
  const jsonPath = Object.keys(files).find((name) => name === "theme.json" || name.endsWith("/theme.json"));
  if (!jsonPath) return { ok: false, error: "U .zip-u nema theme.json. Tema se pravi izvozom iz panela (Teme → Preuzmi)." };
  const root = jsonPath.slice(0, -"theme.json".length);
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(strFromU8(files[jsonPath]));
  } catch {
    return { ok: false, error: "theme.json nije ispravan JSON." };
  }
  if (meta.format !== FORMAT) return { ok: false, error: "theme.json nije tema ShopCRM-a." };

  const notes: string[] = [];
  const base = THEME_LIST.find((theme) => theme.id === meta.base)?.id;
  if (!base) notes.push(`Tema iz koda „${String(meta.base)}" nije instalirana, pa je osnova „${THEME_LIST[0].name}".`);

  // Slike iz paketa ulaze u biblioteku slika; adresa slike koja već postoji na ovom sajtu ostaje.
  const map = new Map<string, string>();
  let missing = 0;
  for (const src of mediaIn(meta)) {
    const inZip = files[`${root}images/${src.slice("/media/".length)}`];
    if (inZip && detectImage(Buffer.from(inZip))) {
      const saved = await saveImage(Buffer.from(inZip), `tema-${src.slice("/media/".length).replace(/\.[a-z]+$/, "").slice(0, 40)}`);
      if (saved.ok) {
        map.set(src, saved.src);
        continue;
      }
    }
    const local = uploadPath(src);
    if (local && existsSync(local)) map.set(src, src);
    else missing++;
  }
  if (missing > 0) notes.push(`Slika kojih nema u paketu: ${missing}. Ta mesta su prazna; ubacite slike u Izgledu sajta.`);

  const css = files[`${root}style.css`] ? strFromU8(files[`${root}style.css`]) : "";
  const design = normalizeDesign({ ...remapMedia(meta, map), customCss: css });
  const library = await getThemeLibrary();
  const name = (typeof meta.name === "string" && meta.name.trim() ? meta.name.trim() : fileName.replace(/\.zip$/i, "")).slice(0, 80);
  const theme: ThemePackage = { id: freeId(name, library.items), name, base: base ?? THEME_LIST[0].id, updatedAt: new Date().toISOString(), design };
  await saveLibrary({ ...library, items: [...library.items, theme] });
  return { ok: true, theme, notes };
}
