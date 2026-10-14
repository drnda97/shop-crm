import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, readJsonBody, TOO_LARGE } from "@/lib/api";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/v1/cart", { method: "POST", body, headers });

describe("telo zahteva API-ja", () => {
  it("čita JSON; neispravan je null", async () => {
    expect(await readJsonBody(post('{"items":[]}'))).toEqual({ items: [] });
    expect(await readJsonBody(post("{nije json"))).toBeNull();
  });

  it("odbija telo veće od granice, i kada zaglavlje o veličini laže ili ga nema", async () => {
    const big = "x".repeat(MAX_BODY_BYTES + 1);
    expect(await readJsonBody(post(big))).toBe(TOO_LARGE);
    expect(await readJsonBody(post("{}", { "content-length": String(MAX_BODY_BYTES + 1) }))).toBe(TOO_LARGE);
  });
});
