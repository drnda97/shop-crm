import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

import { fromLocalInput, isVisible, parseTags, tagList, toLocalInput, type Post } from "@/lib/blog";
import { readIdToken } from "@/lib/google-login";

describe("blog", () => {
  it("sređuje oznake", () => {
    expect(parseTags(" Saveti,  Nega   nameštaja ,saveti,, Novosti")).toEqual(["Saveti", "Nega nameštaja", "Novosti"]);
    expect(parseTags("")).toEqual([]);
  });

  it("kupac vidi samo objavljen članak čiji je datum stigao", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    expect(isVisible({ status: "published", publishedAt: "2026-10-13T11:00:00Z" }, now)).toBe(true);
    expect(isVisible({ status: "published", publishedAt: "2026-10-14T11:00:00Z" }, now)).toBe(false);
    expect(isVisible({ status: "draft", publishedAt: "2026-10-01T11:00:00Z" }, now)).toBe(false);
  });

  it("datum objave se upisuje u vremenskoj zoni prodavnice", () => {
    expect(toLocalInput("2026-10-13T07:30:00.000Z", "Europe/Belgrade")).toBe("2026-10-13T09:30");
    expect(fromLocalInput("2026-10-13T09:30", "Europe/Belgrade")).toBe("2026-10-13T07:30:00.000Z");
    expect(fromLocalInput("2026-01-13T09:30", "Europe/Belgrade")).toBe("2026-01-13T08:30:00.000Z");
    expect(fromLocalInput("2026-10-13T09:30", "America/New_York")).toBe("2026-10-13T13:30:00.000Z");
    expect(fromLocalInput("", "Europe/Belgrade")).toBeNull();
  });

  it("ređa oznake po broju članaka", () => {
    const post = (tags: string[]) => ({ tags }) as Post;
    expect(tagList([post(["Novosti"]), post(["Saveti", "Novosti"]), post(["Akcije"])])).toEqual(["Novosti", "Akcije", "Saveti"]);
  });
});

describe("prijava preko Google naloga", () => {
  const token = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;
  const good = { iss: "https://accounts.google.com", aud: "moj-klijent", exp: Date.now() / 1000 + 600, email: "Kupac@Primer.rs", email_verified: true, given_name: "Ana", family_name: "Anić" };

  it("čita podatke kupca iz žetona", () => {
    expect(readIdToken(token(good), "moj-klijent")).toEqual({ email: "kupac@primer.rs", firstName: "Ana", lastName: "Anić" });
  });

  it("odbija žeton za drugu aplikaciju, istekao, od drugog izdavaoca ili sa nepotvrđenom adresom", () => {
    expect(readIdToken(token(good), "tudji-klijent")).toBeNull();
    expect(readIdToken(token({ ...good, exp: Date.now() / 1000 - 5 }), "moj-klijent")).toBeNull();
    expect(readIdToken(token({ ...good, iss: "https://zlo.example" }), "moj-klijent")).toBeNull();
    expect(readIdToken(token({ ...good, email_verified: false }), "moj-klijent")).toBeNull();
    expect(readIdToken("nije-zeton", "moj-klijent")).toBeNull();
  });
});
