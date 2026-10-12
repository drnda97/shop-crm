/** Obilazak sadržaja radi prevoda: koja polja nose tekst, a koja oznake, adrese i slike. */

/** Polja čija vrednost nije tekst za kupca. */
export const SKIP_KEYS = new Set([
  "id", "slug", "src", "href", "kind", "type", "position", "icon", "anchor", "color", "sku", "image", "gallery",
  "category", "categories", "categoryId", "categoryIds", "collections", "collection", "product", "productSlugs",
  "related", "parent", "variantId", "lowStockMode", "zone", "buttonStyle", "upsell",
]);

const skipped = (key: string) => SKIP_KEYS.has(key) || key.endsWith("Href");

/** Zamenjuje svaki tekst koji ima prevod; ostalo ostaje isto. */
export function translateDeep(value: unknown, words: Map<string, string>, key = ""): unknown {
  if (typeof value === "string") return skipped(key) ? value : (words.get(value) ?? value);
  if (Array.isArray(value)) return value.map((item) => translateDeep(item, words, key));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, skipped(name) ? item : translateDeep(item, words, name)]));
  }
  return value;
}

/** Svi tekstovi u sadržaju, redom kojim se pojavljuju, bez ponavljanja. */
export function collectTexts(value: unknown, into: Set<string> = new Set(), key = ""): Set<string> {
  if (typeof value === "string") {
    const text = value.trim();
    // Tekst je ono što ima bar dva slova zaredom i nije adresa ili šifra boje.
    if (!skipped(key) && /\p{L}{2}/u.test(text) && !/^(https?:\/\/|\/|#[0-9a-f]{3,8}$|[\w.+-]+@[\w.-]+$)/i.test(text)) into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectTexts(item, into, key);
  } else if (typeof value === "object" && value !== null) {
    for (const [name, item] of Object.entries(value)) if (!skipped(name)) collectTexts(item, into, name);
  }
  return into;
}
