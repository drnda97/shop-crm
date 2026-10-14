import { describe, expect, it } from "vitest";
import { MAX_MINOR, toMinor } from "@/lib/format";

describe("iznos iz forme", () => {
  it("prima cifre sa zarezom ili tačkom", () => {
    expect(toMinor("1250", 0)).toBe(1250);
    expect(toMinor(" 12,50 ", 2)).toBe(1250);
    expect(toMinor("12.5", 2)).toBe(1250);
    expect(toMinor("", 2)).toBeNull();
  });

  it("odbija zapise koje Number prima, a nisu iznos", () => {
    for (const value of ["1e3", "0x10", "-5", "Infinity", "1.2.3", "12a"]) expect(toMinor(value, 0)).toBeNaN();
  });

  it("odbija iznos veći od kolone u bazi", () => {
    expect(toMinor(String(MAX_MINOR), 0)).toBe(MAX_MINOR);
    expect(toMinor("99999999999", 0)).toBeNaN();
    expect(toMinor("21474837", 2)).toBeNaN();
  });
});
