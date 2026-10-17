import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings, type Settings } from "@/lib/settings";

// Baza i biblioteka slika u memoriji: tema čita i piše samo podešavanja i zapis „themes".
const state = vi.hoisted(() => ({ stored: new Map<string, string>(), settings: null as unknown as Settings, saved: [] as string[] }));
vi.mock("@/lib/content", () => ({
  getSettings: async () => structuredClone(state.settings),
  getStoredValue: async (name: string) => state.stored.get(name) ?? null,
  setStoredValue: async (name: string, value: string | null) => void (value === null ? state.stored.delete(name) : state.stored.set(name, value)),
  updateContent: async (change: (content: { settings: Settings }) => void) => {
    const content = { settings: structuredClone(state.settings) };
    change(content);
    state.settings = content.settings;
  },
  uploadPath: () => null,
  saveImage: async (_bytes: Buffer, name: string) => {
    const src = `/media/${name}-novo-full.webp`;
    state.saved.push(src);
    return { ok: true, src };
  },
}));

const themes = await import("@/lib/theme-packages");

beforeEach(() => {
  state.stored.clear();
  state.saved = [];
  state.settings = structuredClone({ ...defaultSettings, customCss: "body{color:red}" });
});

describe("teme: biblioteka, objava i brisanje", () => {
  it("prva tema nastaje od izgleda koji sajt ima i aktivna je", async () => {
    const library = await themes.listThemes();
    expect(library.items).toHaveLength(1);
    expect(library.active).toBe(library.items[0].id);
    expect(library.items[0].design.customCss).toBe("body{color:red}");
  });

  it("objava druge teme menja izgled sajta, a izmene dosadašnje ostaju u njenoj kopiji u biblioteci", async () => {
    const first = (await themes.listThemes()).active;
    const copy = (await themes.duplicateTheme(first))!;
    // Vlasnik menja aktivnu temu u Izgledu sajta, pa objavi kopiju.
    state.settings.colors = { ...state.settings.colors, accent: "#ff0000" };
    expect(await themes.publishTheme(copy.id)).toBe(true);
    expect(state.settings.colors.accent).toBe(defaultSettings.colors.accent);
    const library = await themes.listThemes();
    expect(library.active).toBe(copy.id);
    expect(library.items.find((item) => item.id === first)!.design.colors.accent).toBe("#ff0000");
  });

  it("aktivna i jedina tema se ne brišu; ostale se brišu", async () => {
    const only = (await themes.listThemes()).active;
    expect(await themes.deleteTheme(only)).toBe(false);
    const copy = (await themes.duplicateTheme(only))!;
    expect(await themes.deleteTheme(only)).toBe(false);
    expect(await themes.deleteTheme(copy.id)).toBe(true);
    expect((await themes.listThemes()).items).toHaveLength(1);
  });
});

describe("teme: .zip", () => {
  it("preuzeta tema se ubacuje nazad sa istim izgledom i CSS-om, kao nova tema u biblioteci", async () => {
    const active = (await themes.listThemes()).active;
    const file = (await themes.exportTheme(active))!;
    const result = await themes.importTheme(file.bytes, file.name);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const library = await themes.listThemes();
    expect(library.items).toHaveLength(2);
    expect(library.active).toBe(active);
    expect(result.theme.design.customCss).toBe("body{color:red}");
    expect(result.theme.design.colors).toEqual(state.settings.colors);
  });

  it("slike iz paketa ulaze u biblioteku slika; slika koje nema postaju prazne; nepoznata osnova pada na prvu", async () => {
    const meta = {
      format: "shopcrm-theme",
      version: 1,
      name: "Tuđa tema",
      base: "nema-je",
      templates: { collection: { image: { src: "/media/baner-full.webp", alt: "Baner" }, promoImage: { src: "/media/fali-full.webp", alt: "" } } },
    };
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const bytes = zipSync({ "tema/theme.json": strToU8(JSON.stringify(meta)), "tema/style.css": strToU8("a{}</style><script>"), "tema/images/baner-full.webp": png });
    const result = await themes.importTheme(bytes, "tema.zip");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme.base).toBe("default");
    expect(result.theme.design.templates.collection.image.src).toBe(state.saved[0]);
    expect(result.theme.design.templates.collection.promoImage.src).toBe("");
    // Zatvaranje <style> oznake iz CSS-a ne prolazi na stranicu.
    expect(result.theme.design.customCss).not.toMatch(/<\/style/i);
    expect(result.notes.length).toBe(2);
  });

  it("fajl koji nije tema se odbija", async () => {
    expect((await themes.importTheme(strToU8("nije zip"), "x.zip")).ok).toBe(false);
    expect((await themes.importTheme(zipSync({ "a.txt": strToU8("x") }), "x.zip")).ok).toBe(false);
    const zip = zipSync({ "theme.json": strToU8(JSON.stringify({ format: "drugo" })) });
    expect((await themes.importTheme(zip, "x.zip")).ok).toBe(false);
    // Preuzet paket ima theme.json i style.css.
    const exported = (await themes.exportTheme((await themes.listThemes()).active))!;
    expect(Object.keys(unzipSync(exported.bytes)).sort()).toEqual(["style.css", "theme.json"]);
    expect(JSON.parse(strFromU8(unzipSync(exported.bytes)["theme.json"])).format).toBe("shopcrm-theme");
  });
});
