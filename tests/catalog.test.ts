import { describe, expect, it } from "vitest";
import {
  currentPrice,
  getCollectionProducts,
  isAvailable,
  lowStockLabel,
  salePercent,
} from "@/lib/catalog";
import { product } from "./helpers";

describe("cena", () => {
  it("akcija važi samo dok je niža od redovne cene", () => {
    expect(currentPrice(product({ price: 10000, salePrice: 8000 }))).toBe(8000);
    expect(currentPrice(product({ price: 10000, salePrice: 12000 }))).toBe(10000);
    expect(currentPrice(product({ price: 10000, salePrice: 10000 }))).toBe(10000);
  });

  it("procenat akcije se zaokružuje", () => {
    expect(salePercent(product({ price: 3000, salePrice: 2000 }))).toBe(33);
    expect(salePercent(product())).toBeNull();
  });
});

describe("dostupnost", () => {
  it("nacrt, proizvod bez cene i proizvod bez stanja ne mogu da se poruče", () => {
    expect(isAvailable(product())).toBe(true);
    expect(isAvailable(product({ active: false }))).toBe(false);
    expect(isAvailable(product({ price: null }))).toBe(false);
    expect(isAvailable(product({ inStock: false }))).toBe(false);
  });

  it("kada se vodi broj komada, ručno stanje se ne gleda", () => {
    expect(isAvailable(product({ inStock: false, stockQty: 2 }))).toBe(true);
    expect(isAvailable(product({ inStock: true, stockQty: 0 }))).toBe(false);
  });
});

describe("oznaka „pri kraju”", () => {
  it("u režimu auto se prikazuje tek kada broj padne na prag", () => {
    const auto = { lowStockMode: "auto" as const, lowStockThreshold: 3 };
    expect(lowStockLabel(product({ ...auto, stockQty: 4 }))).toBeNull();
    expect(lowStockLabel(product({ ...auto, stockQty: 3 }))).toBe("Još samo 3 kom.");
    expect(lowStockLabel(product({ ...auto, stockQty: 1 }))).toBe("Još samo 1 komad");
  });

  it("ne prikazuje se kada proizvoda nema, ni u režimu always", () => {
    expect(lowStockLabel(product({ lowStockMode: "always", stockQty: 0 }))).toBeNull();
    expect(lowStockLabel(product({ lowStockMode: "always" }))).toBe("Pri kraju");
  });
});

describe("kolekcija", () => {
  it("čuva svoj redosled i preskače obrisane proizvode", () => {
    const products = [product({ slug: "a" }), product({ slug: "b" })];
    const collection = { id: "k", name: "K", description: "", productSlugs: ["b", "nema", "a"] };
    expect(getCollectionProducts(collection, products).map((item) => item.slug)).toEqual(["b", "a"]);
  });
});
