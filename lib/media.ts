/**
 * Adrese ubačenih slika i njihovih veličina. Bez pristupa disku, pa sme i u "use client"
 * komponente; slike pravi lib/images.ts pri ubacivanju.
 *
 * Fotografija ubačena iz panela čuva se kao WebP u više širina:
 *   /media/ime-abc123-full.webp   najveća (do FULL_WIDTH piksela) — ova putanja se čuva u sadržaju
 *   /media/ime-abc123-w640.webp   manje veličine, za kartice, sličice i telefone
 */

/** Širine manjih veličina, u pikselima. */
export const IMAGE_WIDTHS = [320, 640, 1024, 1600] as const;
/** Najveća širina; šira slika se smanjuje pri ubacivanju. */
export const FULL_WIDTH = 2400;

const FULL = /^(\/media\/[a-z0-9-]+)-full\.webp$/;
/** Ime fajla manje veličine: ne prikazuje se u biblioteci kao posebna slika. */
export const VARIANT_FILE = /-w\d+\.webp$/;

/** Da li slika ima manje veličine (ubačena je posle uvođenja obrade slika). */
export function hasSizes(src: string): boolean {
  return FULL.test(src);
}

/** Putanja do veličine najbliže traženoj širini; slika bez veličina vraća samu sebe. */
export function sizedSrc(src: string, width: number): string {
  const base = src.match(FULL)?.[1];
  if (!base) return src;
  const fit = IMAGE_WIDTHS.find((candidate) => candidate >= width);
  return fit ? `${base}-w${fit}.webp` : src;
}

/** Vrednost atributa srcset: pregledač sam bira veličinu prema ekranu. null za sliku bez veličina. */
export function srcSet(src: string): string | null {
  const base = src.match(FULL)?.[1];
  if (!base) return null;
  return [...IMAGE_WIDTHS.map((width) => `${base}-w${width}.webp ${width}w`), `${src} ${FULL_WIDTH}w`].join(", ");
}

/** Sve veličine jedne slike po nazivu, za API; null za sliku bez veličina. */
export function imageSizes(src: string): Record<"thumb" | "small" | "medium" | "large" | "full", string> | null {
  if (!hasSizes(src)) return null;
  const [thumb, small, medium, large] = IMAGE_WIDTHS.map((width) => sizedSrc(src, width));
  return { thumb, small, medium, large, full: src };
}

/**
 * Ime slike za biblioteku, bez dodatka koji panel dodaje pri ubacivanju:
 * „/media/fotelja-mio-mf3k2a9b1c4d-full.webp" → „fotelja-mio".
 */
export function mediaName(src: string): string {
  return (src.split("/").pop() ?? src)
    .replace(/\.[a-z]+$/, "")
    .replace(/-full$/, "")
    .replace(/-(?=[a-z]*\d)[a-z0-9]{9,12}$/, "");
}

/** Format fajla za prikaz: „WebP", „JPG", „PNG" ili „SVG". */
export function mediaFormat(src: string): string {
  const extension = src.split(".").pop()?.toLowerCase() ?? "";
  return extension === "webp" ? "WebP" : extension.toUpperCase();
}
