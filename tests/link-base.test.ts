import { describe, expect, it, vi } from "vitest";
import { isLoopbackUrl, linkBase, publicBase } from "@/lib/mail";
import { mergeSettings } from "@/lib/settings";

const withSite = (storefrontUrl: string) => {
  const settings = mergeSettings({});
  settings.store.storefrontUrl = storefrontUrl;
  return settings;
};

describe("adresa za linkove u emailu", () => {
  it("nikad ne uzima domen iz zaglavlja zahteva", () => {
    const attacker = new Headers({ host: "evil.example", "x-forwarded-host": "evil.example" });
    expect(linkBase(withSite(""), attacker)).toBe("");
    expect(linkBase(withSite("https://mojsajt.rs/"), attacker)).toBe("https://mojsajt.rs");
  });

  it("PUBLIC_URL ima prednost nad adresom iz Podešavanja", () => {
    vi.stubEnv("PUBLIC_URL", "https://crm.mojsajt.rs/");
    try {
      expect(linkBase(withSite("https://mojsajt.rs"))).toBe("https://crm.mojsajt.rs");
      expect(publicBase(withSite(""))).toBe("https://crm.mojsajt.rs");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("lokalno, bez upisane adrese, radi na localhost-u", () => {
    expect(linkBase(withSite(""), new Headers({ host: "localhost:3001" }))).toBe("http://localhost:3001");
    expect(linkBase(withSite(""), new Headers({ host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
    // X-Forwarded-Host se ne gleda ni lokalno.
    expect(linkBase(withSite(""), new Headers({ host: "localhost:3000", "x-forwarded-host": "evil.example" }))).toBe("http://localhost:3000");
    expect(linkBase(withSite(""), new Headers({ host: "localhost.evil.example" }))).toBe("");
  });

  it("prepoznaje lokalne adrese", () => {
    expect(isLoopbackUrl("http://localhost:3000")).toBe(true);
    expect(isLoopbackUrl("https://evil.example")).toBe(false);
    expect(isLoopbackUrl("http://localhost@evil.example")).toBe(false);
  });
});
