import { describe, expect, it } from "vitest";
import { findStockProblem, getPricing, getWeight, MAX_QTY, toLines } from "@/lib/cart";
import { product } from "./helpers";

const shipping = { deliveryPrice: 500, freeShippingFrom: null };

describe("stavke korpe", () => {
  it("preskače nepoznate i nedostupne proizvode", () => {
    const products = [product({ slug: "a" }), product({ slug: "b", active: false })];
    const lines = toLines(
      [
        { slug: "a", qty: 2 },
        { slug: "b", qty: 1 },
        { slug: "nema", qty: 1 },
      ],
      products,
    );
    expect(lines).toEqual([{ product: products[0], qty: 2 }]);
  });

  it("svodi količinu na stanje i na opšte ograničenje", () => {
    const products = [product({ slug: "a", stockQty: 3 }), product({ slug: "b" })];
    const lines = toLines(
      [
        { slug: "a", qty: 10 },
        { slug: "b", qty: 500 },
      ],
      products,
    );
    expect(lines.map((line) => line.qty)).toEqual([3, MAX_QTY]);
  });
});

describe("provera stanja pre upisa", () => {
  it("javlja kada nema dovoljno komada", () => {
    const products = [product({ stockQty: 2 })];
    expect(findStockProblem([{ slug: "stolica", qty: 2 }], products)).toBeNull();
    expect(findStockProblem([{ slug: "stolica", qty: 3 }], products)).toContain("još samo 2 kom.");
  });

  it("javlja kada proizvod više nije na stanju", () => {
    const problem = findStockProblem([{ slug: "stolica", qty: 1 }], [product({ inStock: false })]);
    expect(problem).toContain("nije na stanju");
  });
});

describe("obračun", () => {
  const lines = [
    { product: product({ price: 10000, salePrice: 8000, weight: 1500 }), qty: 2 },
    { product: product({ slug: "sto", price: 4000 }), qty: 1 },
  ];

  it("sabira po ceni koju kupac plaća i dodaje dostavu", () => {
    expect(getPricing(lines, shipping)).toEqual({
      subtotal: 20000,
      discount: 0,
      delivery: 500,
      total: 20500,
    });
  });

  it("popust se oduzima od zbira proizvoda, ne od dostave", () => {
    expect(getPricing(lines, { ...shipping, discountPercent: 10 })).toEqual({
      subtotal: 20000,
      discount: 2000,
      delivery: 500,
      total: 18500,
    });
  });

  it("prag besplatne dostave gleda iznos posle popusta", () => {
    const free = { deliveryPrice: 500, freeShippingFrom: 20000 };
    expect(getPricing(lines, free).delivery).toBe(0);
    expect(getPricing(lines, { ...free, discountPercent: 10 }).delivery).toBe(500);
  });

  it("težina ne računa proizvode bez upisane težine", () => {
    expect(getWeight(lines)).toBe(3000);
  });
});
