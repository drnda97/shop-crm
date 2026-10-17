/**
 * Kolačić u kom biblioteka slika pamti izabran filter i redosled („unused:largest"). Upisuje ga
 * biblioteka u pregledaču, a čita stranica na serveru, pa se spisak odmah iscrta u tom obliku.
 */
export const MEDIA_VIEW_COOKIE = "shopcrm-slike";

/** Upisuje izbor u kolačić; poziva se samo u pregledaču. */
export function saveMediaView(value: string) {
  document.cookie = `${MEDIA_VIEW_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}
