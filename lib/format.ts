/**
 * Iznosi se svuda čuvaju kao ceo broj najmanjih jedinica valute: dinari kada
 * valuta nema decimale (RSD), centi kada ih ima (EUR). `decimals` je 0 ili 2.
 */
export type Currency = { code: string; decimals: number };

function group(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 125000 → "1.250,00" (decimals 2) ili "125.000" (decimals 0). Ručno, da server i pregledač daju isti zapis. */
export function formatAmount(value: number, decimals: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(Math.round(value));
  if (decimals === 0) return sign + group(String(abs));
  const factor = 10 ** decimals;
  const rest = String(abs % factor).padStart(decimals, "0");
  return `${sign}${group(String(Math.floor(abs / factor)))},${rest}`;
}

export function formatMoney(value: number | null, currency: Currency): string {
  return value === null ? "—" : `${formatAmount(value, currency.decimals)} ${currency.code}`;
}

/**
 * Iznos iz forme u najmanje jedinice. null: prazno polje; NaN: nije ispravan iznos.
 * Prima i zarez i tačku kao decimalni znak.
 */
export function toMinor(input: string, decimals: number): number | null {
  const value = input.trim().replace(",", ".");
  if (value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return NaN;
  return Math.round(amount * 10 ** decimals);
}

/** Vrednost za polje forme: 125000 → "1250.00". */
export function fromMinor(value: number | null | undefined, decimals: number): string {
  if (value == null) return "";
  return (value / 10 ** decimals).toFixed(decimals);
}

export function formatWeight(grams: number): string {
  return `${group(String(Math.round(grams)))} g`;
}

/** 1 komad, 2 komada, 5 komada, 21 komad. */
export function formatPieces(count: number): string {
  const one = count % 10 === 1 && count % 100 !== 11;
  return `${count} ${one ? "komad" : "komada"}`;
}

/** 1 proizvod, 2 proizvoda, 8 proizvoda, 21 proizvod. */
export function formatProductCount(count: number): string {
  const one = count % 10 === 1 && count % 100 !== 11;
  return `${count} ${one ? "proizvod" : "proizvoda"}`;
}

/** 1 porudžbina, 2 porudžbine, 5 porudžbina, 21 porudžbina. */
export function formatOrderCount(count: number): string {
  const last = count % 10;
  const teens = count % 100 >= 11 && count % 100 <= 14;
  const word = last >= 2 && last <= 4 && !teens ? "porudžbine" : "porudžbina";
  return `${count} ${word}`;
}
