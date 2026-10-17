import { describe, expect, it } from "vitest";
import { findStockProblem, getSubtotal, maxQty, toLines } from "@/lib/cart";
import {
  currentPrice,
  hasPrice,
  isAvailable,
  isOnSale,
  isSoldOut,
  isVariantAvailable,
  lowStockLabel,
  lowStockUnits,
  MAX_VARIANTS,
  parseOptions,
  priceRange,
  regularPrice,
  soldOutVariants,
  stockUnits,
  syncVariants,
  variantId,
  type Variant,
} from "@/lib/catalog";
import { itemName, parseItems } from "@/lib/orders";
import { product } from "./helpers";

const options = parseOptions("Boja: Crna, Bela\nVeličina: S, M, L");

function variant(id: string, change: Partial<Variant> = {}): Variant {
  return { id, values: id.split("-"), price: null, salePrice: null, sku: "", stockQty: null, enabled: true, ...change };
}

describe("varijante iz opcija", () => {
  it("po jedna za svaku kombinaciju, redom opcija", () => {
    const variants = syncVariants(options, []);
    expect(variants.map((item) => item.id)).toEqual(["crna-s", "crna-m", "crna-l", "bela-s", "bela-m", "bela-l"]);
    expect(variants[1]).toEqual({ id: "crna-m", values: ["Crna", "M"], price: null, salePrice: null, sku: "", stockQty: null, enabled: true });
  });

  it("postojeća kombinacija zadržava cenu i stanje, uklonjena nestaje", () => {
    const existing = [variant("crna-m", { price: 5000, stockQty: 3, sku: "CM" }), variant("zelena-m", { price: 1 })];
    const variants = syncVariants(options, existing);
    expect(variants.find((item) => item.id === "crna-m")).toMatchObject({ price: 5000, stockQty: 3, sku: "CM", values: ["Crna", "M"] });
    expect(variants.some((item) => item.id === "zelena-m")).toBe(false);
  });

  it("bez opcija i preko najvećeg broja nema varijanti", () => {
    expect(syncVariants([], [])).toEqual([]);
    const many = parseOptions(`A: ${Array.from({ length: 11 }, (_, i) => `a${i}`)}\nB: ${Array.from({ length: 10 }, (_, i) => `b${i}`)}`);
    expect(many[0].values.length * many[1].values.length).toBeGreaterThan(MAX_VARIANTS);
    expect(syncVariants(many, [])).toEqual([]);
  });

  it("oznaka je bez kvačica; dve vrednosti sa istom oznakom daju jednu varijantu", () => {
    expect(variantId(["Bež", "Široka 42"])).toBe("bez-siroka-42");
    expect(syncVariants(parseOptions("Boja: Bež, Bez"), [])).toHaveLength(1);
  });
});

describe("cena i stanje varijante", () => {
  const item = product({
    price: 10000,
    salePrice: 8000,
    stockQty: 0,
    variants: [
      variant("crna-s"),
      variant("crna-m", { price: 12000 }),
      variant("crna-l", { price: 12000, salePrice: 9000, stockQty: 2 }),
      variant("bela-s", { stockQty: 0 }),
      variant("bela-m", { enabled: false }),
    ],
  });
  const [inherits, own, sale, soldOut, disabled] = item.variants;

  it("bez sopstvene cene važe cena i akcija proizvoda", () => {
    expect(currentPrice(item, inherits)).toBe(8000);
    expect(currentPrice(item, own)).toBe(12000);
    expect(currentPrice(item, sale)).toBe(9000);
  });

  it("varijanta bez svoje cene, a sa svojom akcijom, je na akciji sama, od cene proizvoda", () => {
    const plain = product({ price: 10000, variants: [variant("crna-s", { salePrice: 7000 }), variant("bela-s")] });
    const [onSale, regular] = plain.variants;
    expect([regularPrice(plain, onSale), currentPrice(plain, onSale), isOnSale(plain, onSale)]).toEqual([10000, 7000, true]);
    expect([currentPrice(plain, regular), isOnSale(plain, regular)]).toEqual([10000, false]);
    // Akcija varijante viša od cene proizvoda ne važi.
    expect(currentPrice(product({ price: 5000, variants: [variant("a", { salePrice: 6000 })] }), variant("a", { salePrice: 6000 }))).toBe(5000);
  });

  it("stanje se gleda po varijanti; broj komada uz proizvod tada ne važi", () => {
    // Proizvod ima stockQty 0, ali varijanta bez svog broja prati ručno stanje (na stanju).
    expect(isVariantAvailable(item, inherits)).toBe(true);
    expect(isVariantAvailable(item, soldOut)).toBe(false);
    expect(isVariantAvailable(item, disabled)).toBe(false);
    expect(isAvailable(item)).toBe(true);
    expect(isAvailable({ ...item, variants: [soldOut, disabled] })).toBe(false);
    expect(maxQty(item, sale)).toBe(2);
  });

  it("raspon cena gleda samo varijante koje mogu da se poruče", () => {
    expect(priceRange(item)).toEqual({ from: 8000, varies: true });
    expect(priceRange({ ...item, variants: [inherits, variant("crna-xl")] })).toEqual({ from: 8000, varies: false });
    expect(priceRange(product({ price: 500 }))).toEqual({ from: 500, varies: false });
  });

  it("korpa: proizvod sa varijantama ulazi samo uz ispravnu varijantu", () => {
    const lines = toLines(
      [
        { slug: "stolica", qty: 1 },
        { slug: "stolica", qty: 5, variant: "crna-l" },
        { slug: "stolica", qty: 1, variant: "bela-s" },
        { slug: "stolica", qty: 1, variant: "ne-postoji" },
        { slug: "stolica", qty: 2, variant: "crna-m" },
      ],
      [item],
    );
    expect(lines.map((line) => [line.variant?.id, line.qty])).toEqual([["crna-l", 2], ["crna-m", 2]]);
    expect(getSubtotal(lines)).toBe(2 * 9000 + 2 * 12000);
  });

  it("varijanta poslata uz proizvod bez varijanti se zanemaruje", () => {
    const simple = product({ slug: "sto", price: 300 });
    expect(toLines([{ slug: "sto", qty: 1, variant: "crna-m" }], [simple])).toEqual([{ product: simple, qty: 1 }]);
  });

  it("poruke o stanju imenuju varijantu", () => {
    expect(findStockProblem([{ slug: "stolica", qty: 1 }], [item])).toContain("Izaberite opcije");
    expect(findStockProblem([{ slug: "stolica", qty: 3, variant: "crna-l" }], [item])).toContain("Stolica (crna, l)");
    expect(findStockProblem([{ slug: "stolica", qty: 1, variant: "bela-s" }], [item])).toContain("nije na stanju");
    expect(findStockProblem([{ slug: "stolica", qty: 2, variant: "crna-l" }], [item])).toBeNull();
  });
});

describe("stavke porudžbine sa varijantom", () => {
  it("isti proizvod u dve varijante su dve stavke; ista varijanta se sabira", () => {
    expect(
      parseItems([
        { slug: "a", qty: 1, variant: "crna-m" },
        { slug: "a", qty: 2, variant: "bela-m" },
        { slug: "a", qty: 3, variant: "crna-m" },
        { slug: "a", qty: 1 },
        { slug: "a", qty: 1, variant: "NIJE ISPRAVNO" },
      ]),
    ).toEqual([
      { slug: "a", qty: 4, variant: "crna-m" },
      { slug: "a", qty: 2, variant: "bela-m" },
      { slug: "a", qty: 2 },
    ]);
  });

  it("naziv stavke nosi varijantu", () => {
    expect(itemName({ name: "Fotelja Mio", variant: "Grafit, Orah" })).toBe("Fotelja Mio — Grafit, Orah");
    expect(itemName({ name: "Hoklica", variant: "" })).toBe("Hoklica");
  });
});

describe("stanje po varijantama u panelu i oznaka „pri kraju”", () => {
  const item = product({
    name: "Mio",
    lowStockMode: "auto",
    lowStockThreshold: 2,
    stockQty: 50,
    variants: [
      variant("crna-s", { stockQty: 2 }),
      variant("crna-m", { stockQty: 0 }),
      variant("crna-l", { stockQty: 9 }),
      variant("bela-s"),
      variant("bela-m", { stockQty: 1, enabled: false }),
    ],
  });

  it("oznaka pripada varijanti; broj komada uz proizvod se ne gleda", () => {
    expect(lowStockLabel(item)).toBeNull();
    expect(lowStockLabel(item, item.variants[0])).toBe("Još samo 2 kom.");
    expect(lowStockLabel(item, item.variants[1])).toBeNull();
    expect(lowStockLabel(item, item.variants[2])).toBeNull();
    expect(lowStockLabel({ ...item, lowStockMode: "always" }, item.variants[3])).toBe("Pri kraju");
  });

  it("pregled: rasprodate varijante i varijante pri kraju, bez isključenih", () => {
    expect(isSoldOut(item)).toBe(false);
    expect(soldOutVariants(item).map((unit) => unit.name)).toEqual(["Mio — crna, m"]);
    expect(lowStockUnits(item).map((unit) => [unit.name, unit.qty])).toEqual([["Mio — crna, s", 2]]);
    expect(stockUnits(item)).toHaveLength(4);
  });

  it("proizvod je rasprodat tek kada nijedna varijanta nije na stanju", () => {
    const gone = { ...item, variants: [variant("crna-m", { stockQty: 0 }), variant("bela-s", { stockQty: 0 })] };
    expect(isSoldOut(gone)).toBe(true);
    // Tada se javlja ceo proizvod, ne svaka varijanta posebno.
    expect(soldOutVariants(gone)).toEqual([]);
  });

  it("proizvod bez varijanti radi kao i do sada", () => {
    const simple = product({ name: "Sto", stockQty: 1, lowStockMode: "auto", lowStockThreshold: 3 });
    expect(lowStockLabel(simple)).toBe("Još samo 1 komad");
    expect(lowStockUnits(simple).map((unit) => unit.name)).toEqual(["Sto"]);
    expect(isSoldOut(product({ inStock: false }))).toBe(true);
  });

  it("cena: dovoljna je cena na jednoj uključenoj varijanti", () => {
    expect(hasPrice(product({ price: null }))).toBe(false);
    expect(hasPrice(product({ price: null, variants: [variant("crna-s", { price: 900 })] }))).toBe(true);
    expect(hasPrice(product({ price: null, variants: [variant("crna-s", { price: 900, enabled: false })] }))).toBe(false);
  });
});
