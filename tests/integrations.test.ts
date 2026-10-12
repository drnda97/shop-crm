import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiOrder, isWebhookUrl, signWebhook } from "@/lib/integrations";
import type { Order } from "@/lib/orders";

describe("veza sa spoljnim sistemima", () => {
  it("potpis webhook-a je HMAC-SHA256 tela, pa ga primalac može sam da izračuna", () => {
    const body = JSON.stringify({ event: "order.created", data: { order: { number: "1005" } } });
    const expected = createHmac("sha256", "tajna").update(body).digest("hex");
    expect(signWebhook("tajna", body)).toBe(`sha256=${expected}`);
    expect(signWebhook("druga", body)).not.toBe(signWebhook("tajna", body));
    expect(signWebhook("tajna", body + " ")).not.toBe(signWebhook("tajna", body));
  });

  it("adresa webhook-a mora biti http ili https", () => {
    expect(isWebhookUrl("https://primer.rs/hook")).toBe(true);
    expect(isWebhookUrl("http://127.0.0.1:8080/hook")).toBe(true);
    expect(isWebhookUrl("ftp://primer.rs/hook")).toBe(false);
    expect(isWebhookUrl("javascript:alert(1)")).toBe(false);
    expect(isWebhookUrl("primer.rs/hook")).toBe(false);
    expect(isWebhookUrl(`https://primer.rs/${"a".repeat(500)}`)).toBe(false);
  });

  it("porudžbina za spoljne sisteme nema internu belešku ni grešku emaila", () => {
    const order = { number: "1005", total: 5000, adminNote: "zvati posle 5", emailError: "SMTP", customerKey: "381641234567" } as Order;
    expect(apiOrder(order)).toEqual({ number: "1005", total: 5000 });
  });
});
