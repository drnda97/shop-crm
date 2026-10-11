import { describe, expect, it } from "vitest";
import { parseOptions, syncVariants, type Category, type Product } from "@/lib/catalog";
import { csvRecords, parseCsv, toCsv } from "@/lib/csv";
import { applyImport, detectFormat, exportRows, htmlToText, parseImport } from "@/lib/product-import";
import { stockDiff } from "@/lib/stock";
import { product } from "./helpers";

const SHOPIFY = `Handle,Title,Body (HTML),Vendor,Product Category,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Variant Fulfillment Service,Variant Price,Variant Compare At Price,Image Src,Image Position,Image Alt Text,SEO Title,SEO Description,Variant Image,Status
majica,"Majica ""Leto""","<p>Pamučna majica.</p><ul><li>100% pamuk</li><li>Pere se na 30°</li></ul>",Brend,Apparel > Shirts,Majice,"a, b",TRUE,Veličina,S,Boja,Crna,,,MAJ-S-C,200,shopify,5,deny,manual,1990.00,2490.00,https://cdn.example.com/a.jpg,1,,Majica Leto,Opis za Google,https://cdn.example.com/a.jpg,active
majica,,,,,,,,,M,,Crna,,,MAJ-M-C,200,shopify,0,deny,manual,1990.00,2490.00,https://cdn.example.com/b.jpg,2,,,,,
majica,,,,,,,,,S,,Bela,,,MAJ-S-B,200,shopify,3,deny,manual,2190.00,,,,,,,https://cdn.example.com/b.jpg,
sapun,Sapun,<p>Ručno rađen.</p>,,Health > Soap,,,TRUE,Title,Default Title,,,,,SAP-1,100,,0,deny,manual,450,,https://cdn.example.com/s.jpg,1,,,,,draft
`;

const WOO = `ID,Type,SKU,Name,Published,"Is featured?","Visibility in catalog","Short description",Description,"In stock?",Stock,"Weight (kg)","Sale price","Regular price",Categories,Tags,Images,Parent,"Attribute 1 name","Attribute 1 value(s)","Attribute 1 visible","Attribute 1 global"
10,variable,HUD,Duks,1,0,visible,"<p>Topao duks</p>","<p>Opis duksa.</p>",1,,0.6,,,"Odeća > Duksevi, Akcija",,"https://x.com/1.jpg, https://x.com/2.jpg",,Veličina,"S, M",1,1
11,variation,HUD-S,Duks - S,1,0,visible,,,1,4,,2500,3000,,,,id:10,Veličina,S,,1
12,variation,HUD-M,Duks - M,1,0,visible,,,0,0,,,3200,,,,id:10,Veličina,M,,1
20,simple,KAPA,Kapa,1,0,visible,,Opis kape,1,7,0.1,,900,Odeća,,https://x.com/k.jpg,,,,,
30,grouped,G,Grupa,1,0,visible,,,1,,,,,,,,,,,,
40,variation,X,Siroče,1,0,visible,,,1,,,,100,,,,id:999,Veličina,S,,1
`;

describe("čitanje CSV-a", () => {
  it("navodnici, prelom reda u polju i oba razdelnika", () => {
    expect(parseCsv('a,b\n"x, y","red 1\nred 2"\n"kaže ""zdravo""",\n\n')).toEqual([
      ["a", "b"],
      ["x, y", "red 1\nred 2"],
      ['kaže "zdravo"', ""],
    ]);
    expect(parseCsv("﻿a;b\r\n1;2,5\r\n")).toEqual([["a", "b"], ["1", "2,5"]]);
  });

  it("ono što izvoz napiše, uvoz pročita isto", () => {
    const rows = [["naziv", "opis"], ['Stolica "Lena"', "Prvi red\nDrugi; red"], ["Sto", ""]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
    expect(csvRecords(parseCsv(toCsv(rows)))[0]).toEqual({ naziv: 'Stolica "Lena"', opis: "Prvi red\nDrugi; red" });
  });

  it("prepoznaje oblik po zaglavlju", () => {
    expect(detectFormat(SHOPIFY.split("\n")[0].split(","))).toBe("shopify");
    expect(detectFormat(parseCsv(WOO)[0])).toBe("woocommerce");
    expect(detectFormat(["oznaka", "naziv", "cena"])).toBe("shopcrm");
    expect(detectFormat(["ime", "prezime"])).toBeNull();
    expect(parseImport("ime,prezime\nA,B\n", 0)).toBeNull();
  });

  it("HTML opis postaje tekst sa pasusima", () => {
    expect(htmlToText("<p>Prvi &amp; drugi.</p><ul><li>jedan</li><li>dva</li></ul><script>x()</script>")).toBe(
      "Prvi & drugi.\n• jedan\n• dva\nx()",
    );
  });
});

describe("Shopify izvoz", () => {
  const parsed = parseImport(SHOPIFY, 0)!;
  const [shirt, soap] = parsed.products;

  it("redovi sa istom oznakom su jedan proizvod sa varijantama", () => {
    expect(parsed.format).toBe("shopify");
    expect(parsed.products).toHaveLength(2);
    expect(shirt).toMatchObject({
      slug: "majica",
      name: 'Majica "Leto"',
      active: true,
      categories: [["Majice"]],
      description: "Pamučna majica.\n• 100% pamuk\n• Pere se na 30°",
      // Precrtana cena (Compare At) je redovna, a cena je akcijska.
      price: 2490,
      salePrice: 1990,
      weight: 200,
      seoTitle: "Majica Leto",
      images: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
    });
    expect(shirt.options).toEqual([
      { name: "Veličina", values: [{ label: "S" }, { label: "M" }] },
      { name: "Boja", values: [{ label: "Crna" }, { label: "Bela" }] },
    ]);
  });

  it("varijanta ima svoju cenu samo kada se razlikuje; stanje samo kada ga Shopify vodi", () => {
    expect(shirt.variants.map((v) => [v.values.join("/"), v.price, v.salePrice, v.sku, v.stockQty])).toEqual([
      ["S/Crna", null, null, "MAJ-S-C", 5],
      ["M/Crna", null, null, "MAJ-M-C", 0],
      ["S/Bela", 2190, null, "MAJ-S-B", 3],
    ]);
    expect(shirt.variants[2].image).toBe("https://cdn.example.com/b.jpg");
  });

  it("„Default Title” je proizvod bez opcija; status draft je nacrt", () => {
    expect(soap).toMatchObject({ slug: "sapun", active: false, sku: "SAP-1", price: 450, stockQty: null, options: [], variants: [], categories: [["Soap"]] });
  });
});

describe("WooCommerce izvoz", () => {
  const parsed = parseImport(WOO, 2)!;
  const [hoodie, cap] = parsed.products;

  it("varijacije se vezuju za roditelja; cena roditelja je cena prve varijacije", () => {
    expect(parsed.products.map((item) => item.slug)).toEqual(["duks", "kapa"]);
    expect(hoodie).toMatchObject({
      categories: [["Odeća", "Duksevi"], ["Akcija"]],
      summary: "Topao duks",
      description: "Opis duksa.",
      weight: 600,
      price: 300000,
      salePrice: 250000,
      stockQty: null,
      images: ["https://x.com/1.jpg", "https://x.com/2.jpg"],
    });
    expect(hoodie.variants).toEqual([
      { values: ["S"], price: null, salePrice: null, sku: "HUD-S", stockQty: 4, enabled: true },
      { values: ["M"], price: 320000, salePrice: null, sku: "HUD-M", stockQty: 0, enabled: false },
    ]);
  });

  it("običan proizvod nosi svoje stanje i težinu u gramima", () => {
    expect(cap).toMatchObject({ slug: "kapa", sku: "KAPA", price: 90000, stockQty: 7, weight: 100, categories: [["Odeća"]] });
  });

  it("ono što ne može da se uveze je navedeno u upozorenjima", () => {
    expect(parsed.warnings.some((text) => text.includes("grouped"))).toBe(true);
    expect(parsed.warnings.some((text) => text.includes("bez roditelja"))).toBe(true);
  });
});

describe("upis u katalog", () => {
  const category = (id: string, label: string, parent = ""): Category => ({ id, label, parent, description: "", seoTitle: "", seoDescription: "" });

  it("pravi proizvode, kategorije po putanji i varijante; kombinacija koje nema u CSV-u je isključena", () => {
    const content = { products: [] as Product[], categories: [category("odeca", "Odeća")] };
    const images = new Map([["https://cdn.example.com/a.jpg", "/media/a-full.webp"], ["https://cdn.example.com/b.jpg", "/media/b-full.webp"]]);
    const stats = applyImport(content, [...parseImport(SHOPIFY, 0)!.products, ...parseImport(WOO, 0)!.products], images);
    expect(stats).toEqual({ created: 4, updated: 0, categories: 4 });
    expect(content.categories.map((item) => `${item.parent}/${item.id}`)).toEqual(["/odeca", "/majice", "/soap", "odeca/duksevi", "/akcija"]);

    const shirt = content.products.find((item) => item.slug === "majica")!;
    expect(shirt).toMatchObject({ category: "majice", image: "/media/a-full.webp", gallery: ["/media/b-full.webp"] });
    expect(shirt.variants.map((v) => [v.id, v.enabled, v.price, v.stockQty, v.image])).toEqual([
      ["s-crna", true, null, 5, "/media/a-full.webp"],
      ["s-bela", true, 2190, 3, "/media/b-full.webp"],
      ["m-crna", true, null, 0, undefined],
      ["m-bela", false, null, null, undefined],
    ]);
    expect(content.products.find((item) => item.slug === "duks")!.categories).toEqual(["duksevi", "akcija"]);
  });

  it("postojeći proizvod se menja, a ono što CSV ne nosi ostaje; bez preuzetih slika ostaju stare", () => {
    const existing = product({
      slug: "sapun",
      name: "Stari sapun",
      image: "/media/stara-full.webp",
      gallery: ["/media/g-full.webp"],
      attributes: [{ title: "Sastav", text: "Maslinovo ulje" }],
      related: ["majica"],
      lowStockMode: "auto",
      lowStockThreshold: 2,
    });
    const content = { products: [existing], categories: [] as Category[] };
    const stats = applyImport(content, parseImport(SHOPIFY, 0)!.products.slice(1), new Map());
    expect(stats).toMatchObject({ created: 0, updated: 1 });
    expect(content.products).toHaveLength(1);
    expect(content.products[0]).toMatchObject({
      name: "Sapun",
      price: 450,
      active: false,
      image: "/media/stara-full.webp",
      gallery: ["/media/g-full.webp"],
      attributes: [{ title: "Sastav", text: "Maslinovo ulje" }],
      related: ["majica"],
      lowStockThreshold: 2,
    });
  });

  it("sopstveni izvoz se uvozi nazad bez gubitka", () => {
    const options = parseOptions("Boja: Crna #000000, Bela\nVeličina: S, M");
    const variants = syncVariants(options, []).map((variant, index) =>
      index === 1 ? { ...variant, price: 5500, salePrice: 5000, sku: "C-M", stockQty: 4, image: "/media/b-full.webp" } : index === 3 ? { ...variant, enabled: false } : variant,
    );
    const categories = [category("odeca", "Odeća"), category("majice", "Majice", "odeca"), category("akcija", "Akcija")];
    const original = [
      product({ slug: "majica", name: 'Majica "Leto"; pamuk', categories: ["majice", "akcija"], category: "majice", price: 4990, salePrice: 4490, weight: 180, description: "Prvi pasus.\n\nDrugi pasus.", summary: "Kratko", image: "/media/a-full.webp", gallery: ["/media/b-full.webp"], options, variants, seoTitle: "SEO", seoDescription: "Opis" }),
      product({ slug: "sto", name: "Sto", active: false, inStock: false, stockQty: 3, price: null, sku: "STO-1" }),
    ];
    const csv = toCsv(exportRows(original, categories, 2, "https://shop.rs"));
    const parsed = parseImport(csv, 2)!;
    expect(parsed.format).toBe("shopcrm");
    const content = { products: [] as Product[], categories: structuredClone(categories) };
    applyImport(content, parsed.products, new Map([["https://shop.rs/media/a-full.webp", "/media/a-full.webp"], ["https://shop.rs/media/b-full.webp", "/media/b-full.webp"]]));
    expect(content.categories).toEqual(categories);
    expect(content.products).toEqual(original);
  });
});

describe("istorija stanja", () => {
  it("beleži promenu broja komada i početak vođenja; prestanak i isto stanje ne", () => {
    const options = parseOptions("Veličina: S, M");
    const before = [
      product({ slug: "a", stockQty: 5 }),
      product({ slug: "b", stockQty: null }),
      product({ slug: "c", stockQty: 2 }),
      product({ slug: "d", stockQty: 9, options, variants: syncVariants(options, []).map((v) => ({ ...v, stockQty: 3 })) }),
    ];
    const after = [
      product({ slug: "a", stockQty: 2 }),
      product({ slug: "b", stockQty: 7 }),
      product({ slug: "c", stockQty: null }),
      product({ slug: "d", stockQty: 1, options, variants: syncVariants(options, []).map((v, i) => ({ ...v, stockQty: i === 0 ? 3 : 10 })) }),
      product({ slug: "novi", stockQty: 4 }),
    ];
    expect(stockDiff(before, after, "Izmena u panelu")).toEqual([
      { slug: "a", variantId: "", change: -3, qtyAfter: 2, reason: "Izmena u panelu" },
      { slug: "b", variantId: "", change: 7, qtyAfter: 7, reason: "Izmena u panelu (početno stanje)" },
      // Kod proizvoda sa varijantama broj uz proizvod se ne vodi, samo uz varijante.
      { slug: "d", variantId: "m", change: 7, qtyAfter: 10, reason: "Izmena u panelu" },
      { slug: "novi", variantId: "", change: 4, qtyAfter: 4, reason: "Izmena u panelu (početno stanje)" },
    ]);
  });
});
