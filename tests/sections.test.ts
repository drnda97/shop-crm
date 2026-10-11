import { describe, expect, it } from "vitest";
import { HOME_SLUG } from "@/lib/catalog";
import { DEFAULT_PAGES } from "@/lib/default-pages";
import {
  collectImages,
  newSection,
  normalizeData,
  normalizeSections,
  paragraphs,
  safeHref,
  safeImageSrc,
  SECTION_TYPES,
  sectionType,
} from "@/lib/sections";
import { defaultSite, mergeSite, SITE_FIELDS } from "@/lib/site";

describe("adrese i slike iz panela", () => {
  it("link sme da vodi na sajt, oznaku ili punu adresu", () => {
    for (const href of ["/kolekcija", "/o-nama#proces", "#salon", "https://primer.rs/a?b=1", "mailto:a@b.rs", "tel:+381641234567"]) {
      expect(safeHref(href)).toBe(href);
    }
  });

  it("sve ostalo se odbacuje", () => {
    for (const href of ["javascript:alert(1)", " JavaScript:alert(1)", "//zlo.rs", "data:text/html,x", "kolekcija", '/a"onclick="x', "/a b", 5, null]) {
      expect(safeHref(href)).toBe("");
    }
  });

  it("slika mora biti iz panela ili iz teme", () => {
    expect(safeImageSrc("/media/slika-abc123.jpg")).toBe("/media/slika-abc123.jpg");
    expect(safeImageSrc("/shop/ds-hero.jpg")).toBe("/shop/ds-hero.jpg");
    for (const src of ["https://zlo.rs/a.jpg", "/media/../.env", "/admin/x.jpg", "/media/", "javascript:x", undefined]) {
      expect(safeImageSrc(src)).toBe("");
    }
  });
});

describe("sadržaj sveden na opis polja", () => {
  const hero = sectionType("hero")!;

  it("polja koja nedostaju dobijaju početnu vrednost, nepoznata se odbacuju", () => {
    const data = normalizeData(hero.fields, { text: "Tekst", nepoznato: "x" });
    expect(data.text).toBe("Tekst");
    expect(data.title).toBe("Naslov prodavnice");
    expect(data.image).toEqual({ src: "", alt: "", position: "" });
    expect(data).not.toHaveProperty("nepoznato");
  });

  it("pogrešan tip ne prolazi", () => {
    const data = normalizeData(hero.fields, { title: 5, buttonHref: "javascript:x", image: "slika", product: "A B" });
    expect(data).toMatchObject({ title: "", buttonHref: "", product: "", image: { src: "" } });
    const products = normalizeData(sectionType("products")!.fields, { limit: "999", tabs: "da" });
    expect(products).toMatchObject({ limit: "4", tabs: false });
  });

  it("lista se skraćuje na najveći broj stavki", () => {
    const features = sectionType("features")!;
    const items = Array.from({ length: 10 }, () => ({ title: "A" }));
    expect((normalizeData(features.fields, { items }).items as unknown[]).length).toBe(4);
    expect(normalizeData(features.fields, { items: "nije lista" }).items).toEqual([]);
  });

  it("nepoznate vrste sekcija se preskaču, a oznake ostaju jedinstvene", () => {
    const sections = normalizeSections([
      { id: "split", type: "split", data: {} },
      { id: "split", type: "split", data: {} },
      { id: "split", type: "split", data: {} },
      { id: "x", type: "ne-postoji", data: {} },
      { type: "cta" },
      null,
    ]);
    expect(sections.map((section) => section.id)).toEqual(["split", "split-2", "split-3", "s"]);
  });

  it("nova sekcija dobija slobodnu oznaku i sva polja", () => {
    const section = newSection("banner", ["banner", "banner-2"]);
    expect(section?.id).toBe("banner-3");
    expect(Object.keys(section!.data)).toEqual(sectionType("banner")!.fields.map((field) => field.key));
    expect(newSection("ne-postoji", [])).toBeNull();
  });

  it("nalazi slike i u listama", () => {
    const split = sectionType("split")!;
    const data = normalizeData(split.fields, {
      images: [{ image: { src: "/shop/a.jpg", alt: "A" } }, { image: { src: "", alt: "" } }, { image: { src: "/media/b.png", alt: "B" } }],
    });
    expect(collectImages(split.fields, data).map((image) => image.src)).toEqual(["/shop/a.jpg", "/media/b.png"]);
  });

  it("prazan red razdvaja pasuse", () => {
    expect(paragraphs("Prvi.\n\n\nDrugi\nred.\n \n")).toEqual(["Prvi.", "Drugi\nred."]);
  });
});

describe("početni sadržaj", () => {
  it("svaka vrsta sekcije ima jedinstvenu oznaku i polja", () => {
    const types = SECTION_TYPES.map((section) => section.type);
    expect(new Set(types).size).toBe(types.length);
    for (const section of SECTION_TYPES) {
      const keys = section.fields.map((field) => field.key);
      expect(new Set(keys).size, section.type).toBe(keys.length);
    }
  });

  it("početne stranice odgovaraju opisu polja: ništa nije odbačeno pri svođenju", () => {
    expect(DEFAULT_PAGES.map((page) => page.slug)).toContain(HOME_SLUG);
    for (const page of DEFAULT_PAGES) {
      expect(page.sections.length, page.slug).toBeGreaterThan(0);
      for (const section of page.sections) {
        const fields = sectionType(section.type)!.fields;
        // Svaka upisana slika i svaki link su prošli proveru.
        const text = JSON.stringify(section.data);
        expect(text, `${page.slug}/${section.id}`).not.toMatch(/"src":""/);
        expect(normalizeData(fields, section.data)).toEqual(section.data);
      }
    }
  });

  it("početni meni i podnožje odgovaraju opisu polja", () => {
    expect(mergeSite(undefined)).toEqual(defaultSite);
    expect(mergeSite({ menu: [{ label: "A", href: "javascript:x" }] }).menu).toEqual([{ label: "A", href: "" }]);
    expect(Object.keys(defaultSite).sort()).toEqual(SITE_FIELDS.map((field) => field.key).sort());
  });
});
