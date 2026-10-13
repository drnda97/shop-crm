import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { THEME_LIST, type ThemeId } from "@/themes/list";

/**
 * Stilovi teme. Ne prolaze kroz build kao ostali CSS: stranica dobija link samo ka stilovima
 * izabrane teme (/api/theme/{id}.css), pa više tema može da stoji u istoj instalaciji a da im se
 * stilovi ne mešaju, ni međusobno ni sa panelom. Samo za server.
 */

type ThemeCss = { css: string; hash: string };

const cached = new Map<ThemeId, ThemeCss>();

export async function themeCss(id: ThemeId): Promise<ThemeCss> {
  // U razvoju se fajl čita svaki put, da se izmena vidi posle osvežavanja stranice.
  const ready = process.env.NODE_ENV === "production" ? cached.get(id) : undefined;
  if (ready) return ready;
  const theme = THEME_LIST.find((candidate) => candidate.id === id) ?? THEME_LIST[0];
  const parts = await Promise.all(theme.styles.map((file) => readFile(path.join(/* turbopackIgnore: true */ process.cwd(), "themes", theme.id, file), "utf8")));
  const css = parts.join("\n");
  const result = { css, hash: createHash("sha1").update(css).digest("hex").slice(0, 12) };
  cached.set(id, result);
  return result;
}

/** Adresa stilova teme; menja se kad god se promeni sadržaj, pa pregledač sme da je pamti trajno. */
export async function themeCssHref(id: ThemeId): Promise<string> {
  return `/api/theme/${id}.css?v=${(await themeCss(id)).hash}`;
}
