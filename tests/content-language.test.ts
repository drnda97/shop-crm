import { describe, expect, it } from "vitest";
import { DEFAULT_PAGES } from "@/lib/default-pages";
import { renamePage, translateContent } from "@/lib/i18n/content";
import { defaultSettings } from "@/lib/settings";

const fresh = () => structuredClone({ pages: DEFAULT_PAGES, settings: defaultSettings });
const hasSerbian = (value: unknown) => /[šđčćž]/i.test(JSON.stringify(value));

describe("početni sadržaj na jeziku sajta", () => {
  it("na engleskom u početnom sadržaju ne ostaje srpski tekst", () => {
    const content = fresh();
    translateContent(content, "sr", "en");
    const { site, templates, abandoned, mail, shipping } = content.settings;
    for (const [name, part] of Object.entries({ site, templates, abandoned, statusEmails: mail.statusEmails, shipping })) {
      expect(hasSerbian(part), `${name}: ${JSON.stringify(part).match(/"[^"]*[šđčćž][^"]*"/i)?.[0]}`).toBe(false);
    }
    for (const page of content.pages) {
      const left = JSON.stringify(page).match(/"[^"]*[šđčćž][^"]*"/i)?.[0];
      expect(left, page.slug).toBeUndefined();
    }
    expect(site.menu.map((item) => item.label)).toContain("About us");
  });

  it("početne stranice dobijaju engleske adrese, a linkovi ka njima ih prate", () => {
    const content = fresh();
    translateContent(content, "sr", "en");
    expect(content.pages.map((page) => page.slug)).toEqual(expect.arrayContaining(["pocetna", "about", "faq", "contact", "terms", "privacy"]));
    const text = JSON.stringify(content);
    expect(text).not.toMatch(/"\/(o-nama|pitanja|kontakt|uslovi-kupovine|privatnost)[#?"]/);
    expect(content.settings.site.menu.map((item) => item.href)).toEqual(expect.arrayContaining(["/about", "/faq", "/contact"]));
    // Adrese ruta prodavnice ostaju kanonske; na jeziku sajta ih ispisuje localPath.
    expect(content.settings.site.menu.map((item) => item.href)).toContain("/kolekcija");
  });

  it("vraćanje na srpski daje isti sadržaj", () => {
    const content = fresh();
    translateContent(content, "sr", "en");
    translateContent(content, "en", "sr");
    expect(content.pages).toEqual(DEFAULT_PAGES);
    expect(content.settings.site).toEqual(defaultSettings.site);
    expect(content.settings.templates).toEqual(defaultSettings.templates);
  });

  it("tekst koji je vlasnik izmenio ostaje, kao i stranica čija je adresa zauzeta", () => {
    const content = fresh();
    content.settings.site.tagline = "Naš opis, napisan ručno.";
    content.pages.push({ ...content.pages[0], slug: "about", title: "Moja stranica" });
    translateContent(content, "sr", "en");
    expect(content.settings.site.tagline).toBe("Naš opis, napisan ručno.");
    expect(content.pages.map((page) => page.slug)).toContain("o-nama");
    expect(content.settings.site.menu.map((item) => item.href)).toContain("/o-nama");
  });

  it("promena adrese stranice ispravlja linkove i odbija zauzetu adresu", () => {
    const content = fresh();
    expect(renamePage(content, "o-nama", "nasa-prica")).toBe(true);
    expect(content.pages.some((page) => page.slug === "nasa-prica")).toBe(true);
    expect(content.settings.site.menu.map((item) => item.href)).toContain("/nasa-prica");
    expect(JSON.stringify(content)).not.toMatch(/"\/o-nama[#"]/);
    expect(renamePage(content, "nasa-prica", "kontakt")).toBe(false);
    expect(renamePage(content, "nasa-prica", "checkout")).toBe(false);
    expect(renamePage(content, "pocetna", "home")).toBe(false);
  });
});
