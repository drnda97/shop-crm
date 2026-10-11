import { describe, expect, it } from "vitest";
import {
  categoryPath,
  categoryTree,
  currentPrice,
  getCollectionProducts,
  inCategory,
  isAvailable,
  lowStockLabel,
  salePercent,
  withDescendants,
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

describe("stablo kategorija", () => {
  const cat = (id: string, parent = "") => ({ id, label: id, parent, description: "", seoTitle: "", seoDescription: "" });
  const categories = [cat("stolice", "namestaj"), cat("namestaj"), cat("barske", "stolice"), cat("rasveta"), cat("siroce", "obrisana")];

  it("stablo ide od nadkategorije ka podkategorijama; kategorija bez roditelja je na vrhu", () => {
    expect(categoryTree(categories).map((item) => `${item.depth}:${item.category.id}`)).toEqual([
      "0:namestaj",
      "1:stolice",
      "2:barske",
      "0:rasveta",
      "0:siroce",
    ]);
  });

  it("put do kategorije i sve njene podkategorije", () => {
    expect(categoryPath(categories, "barske").map((item) => item.id)).toEqual(["namestaj", "stolice", "barske"]);
    expect(withDescendants(categories, "namestaj")).toEqual(["namestaj", "stolice", "barske"]);
    expect(withDescendants(categories, "rasveta")).toEqual(["rasveta"]);
  });

  it("petlja u zapisu ne zaglavljuje", () => {
    const loop = [cat("a", "b"), cat("b", "a")];
    expect(categoryPath(loop, "a").map((item) => item.id)).toEqual(["b", "a"]);
    expect(withDescendants(loop, "a")).toEqual(["a", "b"]);
    expect(categoryTree(loop)).toEqual([]);
  });

  it("proizvod iz podkategorije je i u nadkategoriji", () => {
    const stool = product({ category: "barske", categories: ["barske", "rasveta"] });
    expect(inCategory(stool, "namestaj", categories)).toBe(true);
    expect(inCategory(stool, "rasveta", categories)).toBe(true);
    expect(inCategory(product({ categories: ["namestaj"] }), "stolice", categories)).toBe(false);
  });
});
