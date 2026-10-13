import type { ThemeId } from "./list";

/** Ugovor teme: sve što izvozi themes/default/index.ts. Svaka tema mora imati iste izvoze. */
export type Theme = typeof import("./default");

/**
 * Kod svake teme se učitava tek kada je izabrana, pa se stilovi tema ne mešaju. Nova tema:
 * folder u themes/, red ovde i red u themes/list.ts.
 */
const LOADERS: Record<ThemeId, () => Promise<Theme>> = {
  default: () => import("./default"),
};

export function loadTheme(id: ThemeId): Promise<Theme> {
  return LOADERS[id]();
}
