/**
 * Tema prodavnice: četiri boje i dva fonta koje vlasnik bira u panelu (Izgled sajta → Tema).
 * Sve ostale boje teme (svetlije i tamnije nijanse, tekst na tamnoj pozadini, tekst na dugmetu)
 * računaju se iz te četiri, da sajt ostane čitljiv sa bilo kojom paletom.
 *
 * Bez pristupa bazi, pa sme i u "use client" komponente.
 */

export type ThemeColors = {
  /** Pozadina sajta, kartica i emaila. */
  background: string;
  /** Pozadina traka i istaknutih delova. */
  surface: string;
  /** Tekst, dugmad i tamne sekcije. */
  text: string;
  /** Akcenat: istaknuta dugmad, oznake, linije. */
  accent: string;
};

export const defaultColors: ThemeColors = {
  background: "#ffffff",
  surface: "#f2f3f0",
  text: "#0e2730",
  accent: "#e3a72f",
};

export const colorLabels: Record<keyof ThemeColors, string> = {
  background: "Pozadina",
  surface: "Pozadina traka",
  text: "Tekst i tamne sekcije",
  accent: "Akcenat",
};

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

/* ---------- Fontovi ---------- */

/**
 * Fontovi u ponudi. Svi imaju naša slova (latin-ext) i služe se sa adrese sajta, bez poziva
 * ka Google-u iz pregledača kupca. Novi font se dodaje ovde i u app/(shop)/fonts.ts.
 */
export const FONTS = [
  { id: "red-hat-display", label: "Red Hat Display", kind: "sans" },
  { id: "red-hat-text", label: "Red Hat Text", kind: "sans" },
  { id: "inter", label: "Inter", kind: "sans" },
  { id: "manrope", label: "Manrope", kind: "sans" },
  { id: "montserrat", label: "Montserrat", kind: "sans" },
  { id: "poppins", label: "Poppins", kind: "sans" },
  { id: "dm-sans", label: "DM Sans", kind: "sans" },
  { id: "playfair-display", label: "Playfair Display (serifni)", kind: "serif" },
  { id: "lora", label: "Lora (serifni)", kind: "serif" },
] as const;

export type FontId = (typeof FONTS)[number]["id"];
export type ThemeFonts = { display: FontId; body: FontId };

export const defaultFonts: ThemeFonts = { display: "red-hat-display", body: "red-hat-text" };

export function isFontId(value: unknown): value is FontId {
  return FONTS.some((font) => font.id === value);
}

/** Vrednost CSS svojstva font-family: izabrani font, pa rezervni dok se on ne učita. */
export function fontStack(id: FontId): string {
  const font = FONTS.find((candidate) => candidate.id === id) ?? FONTS[0];
  const fallback = font.kind === "serif" ? "Georgia,'Times New Roman',serif" : "'Avenir Next','Helvetica Neue',sans-serif";
  return `var(--font-${font.id}),${fallback}`;
}

/* ---------- Boje ---------- */

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((part) => Math.round(part).toString(16).padStart(2, "0")).join("")}`;
}

/** Mešavina dve boje: `amount` je udeo druge (0–1). */
export function mix(first: string, second: string, amount: number): string {
  const a = toRgb(first);
  const b = toRgb(second);
  return toHex(a.map((part, index) => part + (b[index] - part) * amount) as Rgb);
}

/** Odnos kontrasta dve boje po WCAG-u: 1 (iste) do 21 (crna i bela). */
export function contrast(first: string, second: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = toRgb(hex).map((part) => {
      const value = part / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** Boja teksta koja se najbolje čita na datoj pozadini, od ponuđenih; pri istom kontrastu prva. */
export function readableOn(background: string, ...choices: string[]): string {
  return choices.reduce((best, color) =>
    contrast(background, color) > contrast(background, best) ? color : best,
  );
}

/**
 * Akcenat kao boja teksta: ako se sam ne čita dovoljno na pozadini (npr. žuta na beloj),
 * pomera se ka boji teksta dok ne dostigne kontrast 4,5.
 */
export function accentText(colors: ThemeColors): string {
  for (let amount = 0; amount <= 1; amount += 0.05) {
    const color = mix(colors.accent, colors.text, amount);
    if (contrast(color, colors.background) >= 4.5) return color;
  }
  return colors.text;
}

/**
 * CSS promenljive teme (themes/default/shop.css) za izabrane boje i fontove. Za početnu paletu
 * se boje ne ispisuju: važe vrednosti upisane u shop.css, tačno po dizajnu.
 */
export function themeVars(colors: ThemeColors, fonts: ThemeFonts): Record<string, string> {
  const vars: Record<string, string> = {
    "--display": fontStack(fonts.display),
    "--sans": fontStack(fonts.body),
  };
  const same = (Object.keys(defaultColors) as (keyof ThemeColors)[]).every(
    (key) => colors[key].toLowerCase() === defaultColors[key],
  );
  if (same) return vars;

  const { background, surface, text, accent } = colors;
  // Tekst na tamnim sekcijama i na dugmadima: svetao ili taman, šta se bolje čita.
  const onInk = readableOn(text, "#ffffff", "#101418");
  return {
    ...vars,
    "--paper": background,
    "--mist": surface,
    "--mist-2": mix(surface, text, 0.05),
    "--ink": text,
    "--ink-2": mix(text, onInk, 0.07),
    "--ink-deep": mix(text, "#000000", 0.25),
    "--soft": mix(text, background, 0.3),
    "--gold": accent,
    "--gold-l": mix(accent, "#ffffff", 0.35),
    "--gold-d": accentText(colors),
    "--on-gold": readableOn(accent, text, background, "#ffffff", "#101418"),
    "--on-ink": onInk,
    "--on-dark": mix(onInk, text, 0.05),
    "--on-dark-soft": mix(onInk, text, 0.14),
    "--on-dark-mute": mix(onInk, text, 0.28),
  };
}
