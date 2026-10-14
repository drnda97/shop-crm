import { describe, expect, it } from "vitest";
import { mergeSettings, productsPerPage } from "@/lib/settings";

describe("broj proizvoda po strani u panelu", () => {
  it("podrazumevano 20, i u starom zapisu podešavanja", () => {
    expect(mergeSettings({}).panel.productsPerPage).toBe(20);
  });

  it("drži se granica 5–200; neispravno je podrazumevano", () => {
    expect(productsPerPage(50)).toBe(50);
    expect(productsPerPage("100")).toBe(100);
    expect(productsPerPage(1)).toBe(5);
    expect(productsPerPage(5000)).toBe(200);
    expect(productsPerPage("abc")).toBe(20);
    expect(productsPerPage(0)).toBe(20);
    expect(mergeSettings({ panel: { productsPerPage: 999 } }).panel.productsPerPage).toBe(200);
  });
});
