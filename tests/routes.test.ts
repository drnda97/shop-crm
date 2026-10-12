import { describe, expect, it } from "vitest";
import { canonicalPath, langPrefix, localPath, ROUTE_SLUGS, splitLang, switchLang } from "@/lib/routes";

describe("adrese stranica na jeziku sajta", () => {
  it("na srpskom se adresa ne menja", () => {
    expect(localPath("sr", "/kolekcija/fotelje?pretraga=1")).toBe("/kolekcija/fotelje?pretraga=1");
  });

  it("na engleskom se prevode deo adrese, parametri i stalne vrednosti", () => {
    expect(localPath("en", "/kolekcija")).toBe("/collection");
    expect(localPath("en", "/kolekcija/fotelje?pretraga=1")).toBe("/collection/fotelje?search=1");
    expect(localPath("en", "/proizvod/fotelja-vera")).toBe("/product/fotelja-vera");
    expect(localPath("en", "/placanje/uplata?porudzbina=1005&ishod=uspeh")).toBe("/checkout/payment?order=1005&result=success");
    expect(localPath("en", "/nalog/lozinka/abc")).toBe("/account/password/abc");
    expect(localPath("en", "/kontakt?tema=uzorci#forma")).toBe("/kontakt?topic=uzorci#forma");
  });

  it("adrese van sajta i stranice iz panela ostaju iste", () => {
    expect(localPath("en", "https://primer.rs/kolekcija")).toBe("https://primer.rs/kolekcija");
    expect(localPath("en", "mailto:a@b.rs")).toBe("mailto:a@b.rs");
    expect(localPath("en", "/o-nama")).toBe("/o-nama");
    expect(localPath("en", "/")).toBe("/");
    // Stranica čija adresa samo počinje isto nije ruta prodavnice.
    expect(localPath("en", "/nalog-firme")).toBe("/nalog-firme");
  });

  it("prevedena adresa se vraća u adresu rute; kanonska se ne dira", () => {
    expect(canonicalPath("/collection/fotelje", "?search=1")).toEqual({ pathname: "/kolekcija/fotelje", search: "?pretraga=1" });
    expect(canonicalPath("/checkout/payment", "?order=1005&result=declined")).toEqual({ pathname: "/placanje/uplata", search: "?porudzbina=1005&ishod=odbijeno" });
    expect(canonicalPath("/checkout", "")).toEqual({ pathname: "/placanje", search: "" });
    expect(canonicalPath("/kolekcija/fotelje", "?pretraga=1")).toBeNull();
    expect(canonicalPath("/o-nama", "")).toBeNull();
    expect(canonicalPath("/collections", "")).toBeNull();
  });

  it("put tamo i nazad daje istu adresu", () => {
    for (const href of ["/kolekcija/stolice?pretraga=1", "/proizvod/x", "/placanje", "/nalog/racun/1005", "/korpa/vrati/t", "/novosti/odjava/t", "/pracenje?broj=1005", "/lista-zelja"]) {
      const [path, query = ""] = localPath("en", href).split("?");
      const back = canonicalPath(path, query ? `?${query}` : "")!;
      expect(`${back.pathname}${back.search}`).toBe(href);
    }
  });

  it("stranica iz panela ne može da zauzme adresu prodavnice ni na jednom jeziku", () => {
    for (const slug of ["kolekcija", "collection", "placanje", "checkout", "nalog", "account", "korpa", "cart", "wishlist", "tracking", "newsletter", "product"]) {
      expect(ROUTE_SLUGS, slug).toContain(slug);
    }
  });

  it("dodatni jezik ima početak u adresi; glavni nema", () => {
    expect(langPrefix("sr", "sr")).toBe("");
    expect(langPrefix("en", "sr")).toBe("/en");
    expect(localPath("en", "/kolekcija/fotelje", "/en")).toBe("/en/collection/fotelje");
    expect(localPath("en", "/", "/en")).toBe("/en");
    expect(localPath("sr", "/kolekcija", "/sr")).toBe("/sr/kolekcija");
    // Jezik bez sopstvenih adresa koristi engleske.
    expect(localPath("de", "/placanje?porudzbina=7", "/de")).toBe("/de/checkout?order=7");
    expect(localPath("de", "/api/v1/products", "/de")).toBe("/api/v1/products");
    expect(localPath("de", "https://primer.rs", "/de")).toBe("https://primer.rs");
  });

  it("jezik se čita sa početka adrese", () => {
    expect(splitLang("/en/collection/fotelje")).toEqual({ lang: "en", pathname: "/collection/fotelje" });
    expect(splitLang("/de")).toEqual({ lang: "de", pathname: "/" });
    expect(splitLang("/pt-br/product/x")).toEqual({ lang: "pt-br", pathname: "/product/x" });
    expect(splitLang("/kolekcija")).toBeNull();
    expect(splitLang("/o-nama")).toBeNull();
    expect(splitLang("/")).toBeNull();
  });

  it("izbor jezika vodi na istu stranicu na drugom jeziku", () => {
    expect(switchLang("/kolekcija/fotelje", "?pretraga=1", "sr", "en", "sr")).toBe("/en/collection/fotelje?search=1");
    expect(switchLang("/en/collection/fotelje", "?search=1", "en", "sr", "sr")).toBe("/kolekcija/fotelje?pretraga=1");
    expect(switchLang("/en/collection/fotelje", "", "en", "de", "sr")).toBe("/de/collection/fotelje");
    expect(switchLang("/", "", "sr", "de", "sr")).toBe("/de");
    expect(switchLang("/de", "", "de", "sr", "sr")).toBe("/");
    expect(switchLang("/o-nama", "", "sr", "en", "sr")).toBe("/en/o-nama");
    // Glavni jezik je engleski: engleske adrese su bez početka.
    expect(switchLang("/collection", "", "en", "sr", "en")).toBe("/sr/kolekcija");
  });
});
