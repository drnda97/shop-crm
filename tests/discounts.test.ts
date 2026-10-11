import { describe, expect, it } from "vitest";
import {
  discountAmount,
  isExpired,
  isValidCode,
  normalizeCode,
  pickDiscount,
} from "@/lib/discounts";
import { discount } from "./helpers";

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
