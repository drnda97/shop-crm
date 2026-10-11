import { describe, expect, it } from "vitest";
import { clientIp, tooMany } from "@/lib/rate-limit";

describe("ograničenje pokušaja", () => {
  it("propušta do granice, pa odbija dok ne prođe deset minuta", () => {
    const start = 1_000_000;
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(tooMany("test-a", "1.1.1.1", 3, start + attempt)).toBe(false);
    }
    expect(tooMany("test-a", "1.1.1.1", 3, start + 10)).toBe(true);
    expect(tooMany("test-a", "1.1.1.1", 3, start + 10 * 60 * 1000 + 5)).toBe(false);
  });

  it("brojači su odvojeni po adresi i po vrsti", () => {
    expect(tooMany("test-b", "1.1.1.1", 1, 0)).toBe(false);
    expect(tooMany("test-b", "1.1.1.1", 1, 1)).toBe(true);
    expect(tooMany("test-b", "2.2.2.2", 1, 1)).toBe(false);
    expect(tooMany("test-c", "1.1.1.1", 1, 1)).toBe(false);
  });

  it("adresa je prva u zaglavlju x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
