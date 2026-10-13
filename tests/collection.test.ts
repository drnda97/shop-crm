import { describe, expect, it } from "vitest";
import { listingSearch, parseListingQuery } from "@/lib/storefront/collection";

describe("izbor kupca na stranici kolekcije", () => {
  it("čita filtere iz adrese i odbacuje neispravne vrednosti", () => {
    const query = parseListingQuery({ pretraga: "  sofa  ", "cena-od": "abc", "cena-do": "5000", opcija: ["Boja:Siva", "bezdvotacke", ":prazno"], sortiraj: "nesto", strana: "-3" });
    expect(query).toEqual({ search: "sofa", min: null, max: 5000, options: { Boja: ["Siva"] }, sort: "rec", page: 1 });
  });

  it("izbor se upisuje u adresu i čita nazad isti", () => {
    const query = parseListingQuery({ pretraga: "sofa i fotelja", "cena-od": "100", opcija: ["Boja:Siva", "Mere:120 × 80"], sortiraj: "desc", strana: "2" });
    const search = listingSearch(query);
    const params: Record<string, string | string[]> = {};
    for (const [key, value] of new URLSearchParams(search)) params[key] = key in params ? [params[key], value].flat() : value;
    expect(parseListingQuery(params)).toEqual(query);
    expect(listingSearch(parseListingQuery({}))).toBe("");
    expect(listingSearch(parseListingQuery({}), true)).toBe("pretraga");
  });
});
