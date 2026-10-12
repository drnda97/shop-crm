import { describe, expect, it } from "vitest";
import { makeT } from "@/lib/i18n";

const dict = {
  en: {
    "Dodaj u korpu": "Add to cart",
    "Porudžbina {broj}": "Order {broj}",
    "Još samo {n} kom.": "Only {n} left",
    "Popust {p}% (kod {kod})": "{p}% off (code {kod})",
  },
};

describe("prevod", () => {
  it("srpski vraća tekst kakav jeste, sa upisanim vrednostima", () => {
    const t = makeT("sr", dict);
    expect(t("Dodaj u korpu")).toBe("Dodaj u korpu");
    expect(t("Porudžbina {broj}", { broj: 1005 })).toBe("Porudžbina 1005");
  });

  it("drugi jezik uzima prevod iz rečnika; tekst kog nema ostaje na srpskom", () => {
    const t = makeT("en", dict);
    expect(t("Dodaj u korpu")).toBe("Add to cart");
    expect(t("Porudžbina {broj}", { broj: 1005 })).toBe("Order 1005");
    expect(t("Nepreveden tekst")).toBe("Nepreveden tekst");
    expect(t("")).toBe("");
  });

  it("poruka sa već upisanim vrednostima prevodi se po obrascu", () => {
    const t = makeT("en", dict);
    expect(t("Još samo 3 kom.")).toBe("Only 3 left");
    expect(t("Popust 10% (kod KOD-7K3Q9X)")).toBe("10% off (code KOD-7K3Q9X)");
    expect(t("Još samo 3 kom. (i tačka)")).toBe("Još samo 3 kom. (i tačka)");
  });

  it("kasniji rečnik ima prednost", () => {
    const t = makeT("en", dict, { en: { "Dodaj u korpu": "Add to bag" } });
    expect(t("Dodaj u korpu")).toBe("Add to bag");
  });
});

describe("jezici prodavnice", () => {
  it("jezik bez rečnika u kodu pada na engleski, a prevodi iz panela imaju prednost", async () => {
    const { makeT: make } = await import("@/lib/i18n");
    const t = make("de", dict, { de: { "Dodaj u korpu": "In den Warenkorb" } });
    expect(t("Dodaj u korpu")).toBe("In den Warenkorb");
    expect(t("Porudžbina {broj}", { broj: 7 })).toBe("Order 7");
    expect(make("sr", dict, { sr: {} })("Dodaj u korpu")).toBe("Dodaj u korpu");
  });

  it("oznake i nazivi jezika", async () => {
    const { langCode, langName } = await import("@/lib/i18n");
    expect(langCode(" DE ")).toBe("de");
    expect(langCode("pt-BR")).toBe("pt-br");
    expect(langCode("english")).toBeNull();
    expect(langCode("d")).toBeNull();
    expect(langName("sr")).toBe("Srpski");
    expect(langName("de")).toBe("Deutsch");
  });

  it("sadržaj se prevodi po tekstu, a oznake, adrese i slike ostaju", async () => {
    const { collectTexts, translateDeep } = await import("@/lib/i18n/walk");
    const product = { slug: "stolica", name: "Stolica", image: "/media/stolica.webp", options: [{ name: "Boja", values: [{ label: "Crna", color: "#000000" }] }], href: "/kolekcija" };
    const words = new Map([["Stolica", "Chair"], ["Boja", "Colour"], ["Crna", "Black"], ["stolica", "x"], ["/kolekcija", "x"]]);
    expect(translateDeep(product, words)).toEqual({ slug: "stolica", name: "Chair", image: "/media/stolica.webp", options: [{ name: "Colour", values: [{ label: "Black", color: "#000000" }] }], href: "/kolekcija" });
    expect([...collectTexts(product)]).toEqual(["Stolica", "Boja", "Crna"]);
  });
});
