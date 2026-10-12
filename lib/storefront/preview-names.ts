/** Nazivi za pregled iz panela; u posebnom fajlu jer ih čita i proxy.ts, koji ne sme da uvozi kod za bazu. */
export const PREVIEW_PARAM = "pregled";
export const PREVIEW_HEADER = "x-shop-preview";
/** Zaglavlje u kom proxy predaje jezik sa početka adrese (/en/…). */
export const LANG_HEADER = "x-shop-lang";
