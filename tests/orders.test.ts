import { describe, expect, it } from "vitest";
import { MAX_QTY } from "@/lib/cart";
import { customerKey, parseItems, parseOrder, phoneDigits, validateCustomer } from "@/lib/orders";
import { customer } from "./helpers";

describe("prepoznavanje kupca", () => {
  it("isti broj telefona daje isti ključ u svakom zapisu", () => {
    const keys = ["064 123 4567", "+381 64 123-4567", "00381641234567", "64/123-4567"].map((phone) =>
      customerKey({ phone, email: "a@b.rs" }, "381"),
    );
    expect(new Set(keys)).toEqual(new Set(["t641234567"]));
    expect(phoneDigits("064 123 4567", "")).toBe("641234567");
  });

  it("bez telefona ključ je email, bez razlike u velikim slovima", () => {
    const a = customerKey({ phone: "", email: " Petar@Example.com " }, "381");
    const b = customerKey({ phone: "", email: "petar@example.com" }, "381");
    expect(a).toBe(b);
    expect(a).toMatch(/^e[A-Za-z0-9_-]+$/);
  });
});

describe("podaci kupca", () => {
  it("ispravni podaci prolaze", () => {
    expect(validateCustomer(customer())).toEqual({});
  });

  it("svako neispravno polje dobija svoju poruku", () => {
    const errors = validateCustomer(
      customer({ name: "P", phone: "abc", email: "petar@", street: "", city: "", postalCode: "1" }),
    );
    expect(Object.keys(errors).sort()).toEqual(["city", "email", "name", "phone", "postalCode", "street"]);
  });

  it("napomena ima najviše 500 znakova", () => {
    expect(validateCustomer(customer({ note: "a".repeat(500) }))).toEqual({});
    expect(validateCustomer(customer({ note: "a".repeat(501) })).note).toBeDefined();
  });
});

describe("čitanje zahteva", () => {
  it("neispravne stavke se preskaču, a isti proizvod se sabira", () => {
    const items = parseItems([
      { slug: "a", qty: 2 },
      { slug: "a", qty: 3 },
      { slug: "b", qty: 0 },
      { slug: "c", qty: 1.5 },
      { slug: "d", qty: "2" },
      { slug: 5, qty: 1 },
      null,
    ]);
    expect(items).toEqual([{ slug: "a", qty: 5 }]);
  });

  it("količina jednog proizvoda ne prelazi opšte ograničenje", () => {
    expect(parseItems([{ slug: "a", qty: 80 }, { slug: "a", qty: 80 }])).toEqual([
      { slug: "a", qty: MAX_QTY },
    ]);
  });

  it("zahtev bez podataka daje praznu porudžbinu, ne grešku", () => {
    for (const input of [null, "tekst", 5, { customer: "x", items: "y" }]) {
      const order = parseOrder(input);
      expect(order.items).toEqual([]);
      expect(order.customer.name).toBe("");
    }
  });

  it("kod se sređuje, a polja skraćuju", () => {
    const order = parseOrder({ customer: { name: "  Ana  ", note: "a".repeat(900) }, discountCode: " leto " });
    expect(order.customer.name).toBe("Ana");
    expect(order.customer.note).toHaveLength(501);
    expect(order.discountCode).toBe("LETO");
  });
});
