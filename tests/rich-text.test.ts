import { describe, expect, it } from "vitest";
import { parseRichText, plainText, richTextImages, safeHref } from "@/lib/rich-text";

describe("tekst članka", () => {
  it("razlaže pasuse, naslove, spiskove, citat i sliku", () => {
    const blocks = parseRichText("Prvi pasus\nu dva reda.\n\n## Naslov\n\n### Podnaslov\n\n- jedan\n- dva\n\n1. prvi\n2. drugi\n\n> citat\n\n![Fotelja](/media/fotelja.jpg)");
    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "heading", "heading", "list", "list", "quote", "image"]);
    expect(blocks[0]).toEqual({ kind: "paragraph", children: [{ kind: "text", text: "Prvi pasus u dva reda." }] });
    expect(blocks[1]).toMatchObject({ level: 2 });
    expect(blocks[2]).toMatchObject({ level: 3 });
    expect(blocks[3]).toMatchObject({ ordered: false });
    expect(blocks[4]).toMatchObject({ ordered: true });
    expect(blocks[6]).toEqual({ kind: "image", src: "/media/fotelja.jpg", alt: "Fotelja" });
  });

  it("u tekstu prepoznaje podebljano, iskošeno i link", () => {
    const [block] = parseRichText("Ovo je **važno**, *lepo* i [link](/kolekcija).");
    expect(block).toEqual({
      kind: "paragraph",
      children: [
        { kind: "text", text: "Ovo je " },
        { kind: "bold", children: [{ kind: "text", text: "važno" }] },
        { kind: "text", text: ", " },
        { kind: "italic", children: [{ kind: "text", text: "lepo" }] },
        { kind: "text", text: " i " },
        { kind: "link", href: "/kolekcija", children: [{ kind: "text", text: "link" }] },
        { kind: "text", text: "." },
      ],
    });
  });

  it("ne propušta opasne adrese ni HTML", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//zlo.example")).toBeNull();
    expect(safeHref("https://primer.rs")).toBe("https://primer.rs");
    expect(safeHref("/kontakt#forma")).toBe("/kontakt#forma");
    const [link] = parseRichText("[klik](javascript:alert(1))");
    expect(JSON.stringify(link)).not.toContain("javascript");
    // HTML ostaje običan tekst; tema ga ispisuje kao tekst, ne kao oznake.
    expect(parseRichText("<script>alert(1)</script>")[0]).toEqual({ kind: "paragraph", children: [{ kind: "text", text: "<script>alert(1)</script>" }] });
    // Slika sa adresom koja nije sa sajta ni https ne postaje slika.
    expect(parseRichText("![x](javascript:alert)").some((block) => block.kind === "image")).toBe(false);
    expect(parseRichText("![x](//zlo.example/a.png)")).toEqual([]);
  });

  it("daje čist tekst za kratak opis i nalazi slike sa sajta", () => {
    const source = "## Naslov\n\nTekst sa **oznakama** i [linkom](/a).\n\n![a](/media/a.jpg)\n\n![b](https://drugi.example/b.jpg)";
    expect(plainText(source)).toBe("Naslov Tekst sa oznakama i linkom.");
    expect(plainText("jedna dva tri četiri pet", 12)).toBe("jedna dva…");
    expect(richTextImages(source)).toEqual(["/media/a.jpg"]);
  });
});
