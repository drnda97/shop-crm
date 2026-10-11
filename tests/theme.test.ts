import { describe, expect, it } from "vitest";
import { formatOptions, parseOptions, parsePairs } from "@/lib/catalog";
import { mergeSettings } from "@/lib/settings";
import { collectImages, normalizeData } from "@/lib/sections";
import { THEME_FIELDS } from "@/lib/site";
import { mergeTemplates, TEMPLATES } from "@/lib/templates";
import { accentText, contrast, defaultColors, defaultFonts, FONTS, fontStack, mix, readableOn, themeVars } from "@/lib/theme";

describe("boje", () => {
  it("mešavina i kontrast", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#0e2730", "#ffffff", 0)).toBe("#0e2730");
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBe(1);
  });

  it("tekst na dugmetu je onaj koji se bolje čita", () => {
    expect(readableOn("#e3a72f", "#0e2730", "#ffffff")).toBe("#0e2730");
    expect(readableOn("#1d3fbf", "#0e2730", "#ffffff")).toBe("#ffffff");
  });

  it("akcenat kao tekst uvek ima kontrast bar 4,5 na pozadini", () => {
    for (const accent of ["#e3a72f", "#ffe600", "#2f5bd7", "#ffffff", "#0e2730"]) {
      const colors = { ...defaultColors, accent };
      expect(contrast(accentText(colors), colors.background), accent).toBeGreaterThanOrEqual(4.5);
    }
    // Akcenat koji se već čita ostaje isti.
    expect(accentText({ ...defaultColors, accent: "#2f5bd7" })).toBe("#2f5bd7");
  });
});

describe("promenljive teme", () => {
  it("početna paleta ne ispisuje boje: važe one iz shop.css", () => {
    const vars = themeVars(defaultColors, defaultFonts);
    expect(Object.keys(vars)).toEqual(["--display", "--sans"]);
    expect(vars["--display"]).toContain("var(--font-red-hat-display)");
    expect(themeVars({ ...defaultColors, text: "#0E2730" }, defaultFonts)).toEqual(vars);
  });

  it("izmenjena paleta daje sve boje, čitljive međusobno", () => {
    const palettes = [
      { background: "#faf6ef", surface: "#f0e9dc", text: "#2b1d12", accent: "#b4532a" },
      // Tamna tema: svetao tekst na tamnoj pozadini.
      { background: "#111418", surface: "#1b2026", text: "#f1f3f5", accent: "#7cc4ff" },
    ];
    for (const colors of palettes) {
      const vars = themeVars(colors, { display: "playfair-display", body: "inter" });
      for (const value of Object.values(vars).slice(2)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrast(vars["--on-ink"], vars["--ink"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--on-gold"], vars["--gold"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--gold-d"], vars["--paper"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--on-dark-mute"], vars["--ink"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars["--soft"], vars["--paper"])).toBeGreaterThanOrEqual(4.5);
      expect(vars["--display"]).toContain("var(--font-playfair-display)");
      expect(vars["--display"]).toContain("serif");
    }
  });

  it("svaki font u ponudi ima svoju promenljivu", () => {
    for (const font of FONTS) expect(fontStack(font.id)).toContain(`var(--font-${font.id})`);
  });
});

describe("podešavanja teme", () => {
  it("neispravna boja i nepoznat font dobijaju početnu vrednost", () => {
    const settings = mergeSettings({
      colors: { ...defaultColors, accent: "red; background:url(x)", text: "#ABCDEF" },
      fonts: { display: "comic-sans" as never, body: "inter" },
    });
    expect(settings.colors.accent).toBe(defaultColors.accent);
    expect(settings.colors.text).toBe("#abcdef");
    expect(settings.fonts).toEqual({ display: defaultFonts.display, body: "inter" });
  });

  it("polja teme u panelu odgovaraju bojama i fontovima", () => {
    const value = normalizeData(THEME_FIELDS, { accent: "nije boja", fontBody: "lora" });
    expect(value).toMatchObject({ ...defaultColors, fontDisplay: FONTS[0].id, fontBody: "lora" });
  });
});

describe("tekstovi stranica sa stalnim rasporedom", () => {
  it("bez zapisa važi sadržaj iz dizajna, sa ispravnim slikama i linkovima", () => {
    const templates = mergeTemplates(undefined);
    expect(templates.collection.title).toBe("Sedenje");
    expect(templates.product.notes).toHaveLength(2);
    expect(templates.checkout.termsHref).toBe("/uslovi-kupovine");
    for (const item of TEMPLATES) {
      const data = templates[item.id];
      expect(Object.keys(data)).toEqual(item.fields.map((field) => field.key));
      for (const image of collectImages(item.fields, data)) expect(image.src).toMatch(/^\/shop\//);
    }
  });

  it("sačuvan zapis menja samo svoja polja; obrisan tekst ostaje prazan", () => {
    const templates = mergeTemplates({ collection: { title: "Sve", promoHeading: "" }, product: { notes: [] } });
    expect(templates.collection).toMatchObject({ title: "Sve", promoHeading: "", promoButtonLabel: "Poručite uzorke" });
    expect(templates.product.notes).toEqual([]);
    expect(templates.cart.emptyHeading).toBe("Korpa je prazna");
  });
});

describe("opcije proizvoda", () => {
  it("čita opcije i boje iz forme i vraća ih u isti oblik", () => {
    const text = "Tkanina: Pesak #B9AB98, Grafit #3c4346\nPostolje: Hrast, Orah, Crni jasen";
    const options = parseOptions(text);
    expect(options).toEqual([
      { name: "Tkanina", values: [{ label: "Pesak", color: "#b9ab98" }, { label: "Grafit", color: "#3c4346" }] },
      { name: "Postolje", values: [{ label: "Hrast" }, { label: "Orah" }, { label: "Crni jasen" }] },
    ]);
    expect(parseOptions(formatOptions(options))).toEqual(options);
  });

  it("preskače redove bez vrednosti", () => {
    expect(parseOptions("Veličina:\n\nSamo naziv\nBoja: , ,")).toEqual([]);
    expect(parsePairs("Širina: 72 cm\nNapomena")).toEqual([["Širina", "72 cm"], ["Napomena", ""]]);
  });
});
