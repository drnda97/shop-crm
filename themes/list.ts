/**
 * Teme koje idu uz ovu instalaciju, za izbor u panelu (Podešavanja → Tema sajta). Ovde su samo
 * nazivi i spisak CSS fajlova; kod teme učitava themes/registry.ts. Nova tema se upisuje na oba mesta.
 */
export const THEME_LIST = [
  {
    id: "default",
    name: "Osnovna",
    description: "Svetla tema sa zaobljenim karticama, uz koju ShopCRM stiže.",
    // CSS fajlovi u folderu teme, redom kojim se učitavaju.
    styles: ["shop.css", "shop-fonts.css"],
  },
] as const;

export type ThemeId = (typeof THEME_LIST)[number]["id"];

export const DEFAULT_THEME: ThemeId = "default";

/** Id teme iz podešavanja; nepoznat (npr. tema koja je u međuvremenu uklonjena) pada na osnovnu. */
export function themeId(value: unknown): ThemeId {
  return THEME_LIST.find((theme) => theme.id === value)?.id ?? DEFAULT_THEME;
}
