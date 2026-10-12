import { describe, expect, it } from "vitest";
import { getPricing } from "@/lib/cart";
import {
  applyRule,
  discountAmount,
  discountText,
  percentRule,
  saving,
  type DiscountRule,
  isExpired,
  isValidCode,
  normalizeCode,
  pickDiscount,
} from "@/lib/discounts";
import { discount, product } from "./helpers";

const facts = { isFirstOrder: false, amount: 0, weight: 0 };

describe("nagrada posle porudžbine", () => {
  it("bira najjaču čiji je uslov ispunjen", () => {
    const rules = [
      discount({ id: "prva", trigger: "first", percent: 5 }),
      discount({ id: "iznos", trigger: "amount", threshold: 10000, percent: 15 }),
      discount({ id: "tezina", trigger: "weight", threshold: 5000, percent: 20 }),
    ];
    expect(pickDiscount(rules, { isFirstOrder: true, amount: 10000, weight: 4999 })?.id).toBe("iznos");
    expect(pickDiscount(rules, { isFirstOrder: true, amount: 9999, weight: 0 })?.id).toBe("prva");
    expect(pickDiscount(rules, facts)).toBeNull();
  });

  it("preskače nacrte i obične promo kodove", () => {
    const rules = [
      discount({ status: "draft", percent: 50 }),
      discount({ trigger: "public", code: "LETO", percent: 40 }),
    ];
    expect(pickDiscount(rules, { ...facts, isFirstOrder: true })).toBeNull();
  });

  it("kod istog procenta uzima prvu u spisku", () => {
    const rules = [discount({ id: "a" }), discount({ id: "b" })];
    expect(pickDiscount(rules, facts)?.id).toBe("a");
  });
});

describe("rok važenja", () => {
  it("kod važi zaključno sa poslednjim danom, u zoni prodavnice", () => {
    const rule = discount({ expiresAt: "2026-03-10" });
    // 22:30 UTC je već 23:30 u Beogradu, a 23:30 UTC je sledeći dan.
    expect(isExpired(rule, "Europe/Belgrade", new Date("2026-03-10T22:30:00Z"))).toBe(false);
    expect(isExpired(rule, "Europe/Belgrade", new Date("2026-03-10T23:30:00Z"))).toBe(true);
    expect(isExpired(discount(), "Europe/Belgrade")).toBe(false);
  });
});

describe("kod", () => {
  it("iznos popusta se zaokružuje na najmanju jedinicu", () => {
    expect(discountAmount(999, 15)).toBe(150);
    expect(discountAmount(20000, 10)).toBe(2000);
  });

  it("piše se velikim slovima, bez razmaka", () => {
    expect(normalizeCode("  leto 2026 ")).toBe("LETO2026");
    expect(isValidCode("LETO-2026")).toBe(true);
    expect(isValidCode("AB")).toBe(false);
    expect(isValidCode("ŠIŠ")).toBe(false);
  });
});

describe("vrste popusta na korpu", () => {
  const cat = (id: string, parent = "") => ({ id, label: id, parent, description: "", seoTitle: "", seoDescription: "" });
  const categories = [cat("namestaj"), cat("stolice", "namestaj"), cat("rasveta")];
  const lines = [
    { product: product({ slug: "stolica", price: 10000, category: "stolice", categories: ["stolice"] }), qty: 2 },
    { product: product({ slug: "lampa", price: 4000, category: "rasveta", categories: ["rasveta"] }), qty: 1 },
  ];
  const rule = (change: Partial<DiscountRule>): DiscountRule => ({ ...percentRule(10), ...change });

  it("procenat na celu korpu, na kategoriju (sa podkategorijama) i na proizvod", () => {
    expect(applyRule(rule({}), lines, categories)).toEqual({ amount: 2400, freeShipping: false });
    expect(applyRule(rule({ categories: ["namestaj"] }), lines, categories)).toEqual({ amount: 2000, freeShipping: false });
    expect(applyRule(rule({ products: ["lampa"] }), lines, categories)).toEqual({ amount: 400, freeShipping: false });
    expect(applyRule(rule({ products: ["lampa"], categories: ["stolice"] }), lines, categories)?.amount).toBe(2400);
  });

  it("fiksni iznos ne prelazi vrednost proizvoda na koje se odnosi", () => {
    expect(applyRule(rule({ kind: "amount", amount: 3000 }), lines, categories)?.amount).toBe(3000);
    expect(applyRule(rule({ kind: "amount", amount: 9000, products: ["lampa"] }), lines, categories)?.amount).toBe(4000);
  });

  it("besplatna dostava ne dira cenu proizvoda", () => {
    expect(applyRule(rule({ kind: "shipping" }), lines, categories)).toEqual({ amount: 0, freeShipping: true });
  });

  it("ne važi ispod najmanjeg iznosa, ni kada u korpi nema proizvoda na koje se odnosi", () => {
    expect(applyRule(rule({ threshold: 24001 }), lines, categories)).toBeNull();
    expect(applyRule(rule({ threshold: 24000 }), lines, categories)?.amount).toBe(2400);
    expect(applyRule(rule({ products: ["nema-ga"] }), lines, categories)).toBeNull();
    expect(applyRule(rule({ kind: "shipping" }), [], categories)).toBeNull();
  });

  it("ušteda računa i dostavu koju popust čini besplatnom", () => {
    expect(saving({ amount: 0, freeShipping: true }, 500)).toBe(500);
    expect(saving({ amount: 300, freeShipping: false }, 500)).toBe(300);
  });

  it("obračun: besplatna dostava popustom, i popust nikad veći od zbira", () => {
    const shipping = { deliveryPrice: 500, freeShippingFrom: null };
    expect(getPricing(lines, { ...shipping, discount: { amount: 0, freeShipping: true } })).toEqual({ subtotal: 24000, discount: 0, delivery: 0, total: 24000 });
    expect(getPricing(lines, { ...shipping, discount: { amount: 99999, freeShipping: false } })).toEqual({ subtotal: 24000, discount: 24000, delivery: 500, total: 500 });
  });

  it("ispis popusta", () => {
    expect(discountText({ code: "LETO10", percent: 10 })).toBe("Popust 10% (kod LETO10)");
    expect(discountText({ code: "MINUS500", percent: null })).toBe("Popust (kod MINUS500)");
    expect(discountText({ code: "", percent: null, label: "Jesenja akcija", freeShipping: true })).toBe("Besplatna dostava — Jesenja akcija");
    expect(discountText({ code: "", percent: 15, label: "" })).toBe("Popust 15%");
  });

  it("nagrade ne uzimaju promo kod ni automatski popust", () => {
    expect(pickDiscount([discount({ trigger: "auto", percent: 90 }), discount({ trigger: "public", percent: 80 })], { isFirstOrder: true, amount: 1e9, weight: 1e9 })).toBeNull();
  });
});
