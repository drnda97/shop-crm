import { describe, expect, it, vi } from "vitest";
import { clientIp, tooMany, tooManyOrders } from "@/lib/rate-limit";

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

  it("adresa je ona koju je dopisao proxy, ne ono što posetilac sam upiše", () => {
    // Posetilac je poslao 6.6.6.6, proxy je dopisao stvarnu adresu 9.9.9.9.
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("TRUSTED_PROXIES: sa dva proxy-ja adresa je druga s kraja", () => {
    vi.stubEnv("TRUSTED_PROXIES", "2");
    try {
      expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
      expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9" }))).toBe("9.9.9.9");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("porudžbine imaju i ukupnu granicu, nezavisnu od adrese", () => {
    const start = 5_000_000;
    for (let order = 0; order < 100; order++) expect(tooManyOrders(start + order)).toBe(false);
    expect(tooManyOrders(start + 200)).toBe(true);
    expect(tooManyOrders(start + 10 * 60 * 1000 + 200)).toBe(false);
  });
});
