import { describe, expect, it } from "vitest";
import { invoiceFileName, invoicePdf } from "@/lib/invoice";
import { fillStatusText } from "@/lib/order-email";
import { includedTax, refundable, type Order } from "@/lib/orders";
import { findProvider, signPayment } from "@/lib/payments";
import { defaultSettings, enabledPayments, mergeSettings } from "@/lib/settings";
import { availableMethods, basePrice, legacyMethods, methodPrice, methodServes, normalizeMethods, type ShippingMethod } from "@/lib/shipping";

function method(change: Partial<ShippingMethod> = {}): ShippingMethod {
  return { id: "kurir", name: "Kurir", hint: "", kind: "delivery", price: 500, freeFrom: null, weightRates: [], zone: "", confirmation: "", ...change };
}

describe("cena dostave", () => {
  it("stalna cena, i besplatno od praga (gleda se iznos posle popusta)", () => {
    const courier = method({ freeFrom: 5000 });
    expect(methodPrice(courier, 4999, 0)).toBe(500);
    expect(methodPrice(courier, 5000, 0)).toBe(0);
    expect(methodPrice(method(), 999999, 0)).toBe(500);
  });

  it("po težini važi prvi red koji pokriva težinu; teže od poslednjeg plaća poslednji", () => {
    const courier = method({ weightRates: [{ upTo: 5000, price: 700 }, { upTo: 1000, price: 400 }, { upTo: 20000, price: 1500 }] });
    expect(basePrice(courier, 0)).toBe(400);
    expect(basePrice(courier, 1000)).toBe(400);
    expect(basePrice(courier, 1001)).toBe(700);
    expect(basePrice(courier, 20000)).toBe(1500);
    expect(basePrice(courier, 99000)).toBe(1500);
    expect(methodPrice({ ...courier, freeFrom: 100 }, 100, 99000)).toBe(0);
  });
});

describe("zone", () => {
  const city = method({ id: "grad", zone: "11, 21 000" });

  it("način se nudi samo za poštanske brojeve iz zone", () => {
    expect(methodServes(city, "11000")).toBe(true);
    expect(methodServes(city, "21 000")).toBe(true);
    expect(methodServes(city, "21101")).toBe(false);
    expect(methodServes(city, "18000")).toBe(false);
    expect(methodServes(method(), "18000")).toBe(true);
  });

  it("dok poštanski broj nije upisan, nude se svi", () => {
    expect(availableMethods([city, method()], "").map((item) => item.id)).toEqual(["grad", "kurir"]);
    expect(availableMethods([city, method()], "18000").map((item) => item.id)).toEqual(["kurir"]);
  });
});

describe("zapis načina dostave", () => {
  it("svodi podatke iz pregledača na ispravan oblik", () => {
    const methods = normalizeMethods([
      { id: "kurir", name: " Kurir ", price: 450.4, freeFrom: 0, kind: "nesto", zone: "11; <script>", weightRates: [{ upTo: 2000, price: 300 }, { upTo: -1, price: 5 }, "x"] },
      { id: "kurir", name: "Drugi", price: -5, kind: "pickup", freeFrom: 9000 },
      { name: "" },
      null,
    ]);
    expect(methods).toEqual([
      { id: "kurir", name: "Kurir", hint: "", kind: "delivery", price: 450, freeFrom: null, weightRates: [{ upTo: 2000, price: 300 }], zone: "11 ", confirmation: "" },
      { id: "kurir-2", name: "Drugi", hint: "", kind: "pickup", price: 0, freeFrom: 9000, weightRates: [], zone: "", confirmation: "" },
    ]);
  });

  it("podešavanja iz prve verzije postaju načini dostave, sa nazivima sa stranice plaćanja", () => {
    const settings = mergeSettings({
      shipping: { price: 1200, freeEnabled: true, freeFrom: 50000, pickupEnabled: true } as never,
      templates: { checkout: { deliveryLabel: "Dostava sa montažom", pickupLabel: "U salonu", thanksPickup: "Spremno za 3 dana." } } as never,
    });
    expect(settings.shipping.methods).toEqual([
      { id: "dostava", name: "Dostava sa montažom", hint: "", kind: "delivery", price: 1200, freeFrom: 50000, weightRates: [], zone: "", confirmation: "" },
      { id: "preuzimanje", name: "U salonu", hint: "", kind: "pickup", price: 0, freeFrom: null, weightRates: [], zone: "", confirmation: "Spremno za 3 dana." },
    ]);
    // Bez besplatne dostave i preuzimanja ostaje jedan način.
    expect(legacyMethods({ price: 300, freeEnabled: false, freeFrom: 5000 })).toHaveLength(1);
    expect(legacyMethods({ price: 300, freeEnabled: false, freeFrom: 5000 })[0].freeFrom).toBeNull();
    // Sačuvani načini se ne prevode ponovo; prazan spisak dobija podrazumevani način.
    expect(mergeSettings({ shipping: { methods: [method()] } }).shipping.methods).toEqual([method()]);
    expect(mergeSettings({ shipping: { methods: [] } }).shipping.methods).toHaveLength(1);
  });
});

describe("plaćanje", () => {
  it("kartica se nudi samo kada je uključena i procesor povezan", () => {
    const on = mergeSettings({ payment: { ...defaultSettings.payment, card: true, cardProvider: "test" } });
    expect(enabledPayments(on)).toEqual(["cod"]);
    expect(enabledPayments(on, true)).toEqual(["cod", "card"]);
    expect(enabledPayments(defaultSettings, true)).toEqual(["cod"]);
    expect(defaultSettings.payment.card).toBe(false);
  });

  it("probni procesor radi samo kada je uključen, i prihvata samo potpisanu potvrdu", async () => {
    const provider = findProvider("test")!;
    const before = { test: process.env.CARD_TEST_PROVIDER, secret: process.env.APP_SECRET };
    delete process.env.CARD_TEST_PROVIDER;
    expect(provider.ready()).toBe(false);
    process.env.CARD_TEST_PROVIDER = "1";
    process.env.APP_SECRET = "tajna";
    expect(provider.ready()).toBe(true);

    const url = (order: string, outcome: string, signature: string) =>
      new Request(`https://shop.rs/api/v1/payments/test?porudzbina=${order}&ishod=${outcome}&potpis=${signature}`);
    expect(await provider.confirm(url("1005", "uspeh", await signPayment("1005", "uspeh")))).toEqual({ orderNumber: "1005", paid: true, reference: "TEST-1005" });
    expect(await provider.confirm(url("1005", "odbijeno", await signPayment("1005", "odbijeno")))).toMatchObject({ paid: false });
    // Potpis za drugu porudžbinu ili drugi ishod ne važi.
    expect(await provider.confirm(url("1006", "uspeh", await signPayment("1005", "uspeh")))).toBeNull();
    expect(await provider.confirm(url("1005", "uspeh", await signPayment("1005", "odbijeno")))).toBeNull();
    expect(await provider.confirm(url("1005", "uspeh", ""))).toBeNull();
    expect(await provider.confirm(url("1005", "nesto", await signPayment("1005", "nesto")))).toBeNull();

    process.env.CARD_TEST_PROVIDER = before.test;
    process.env.APP_SECRET = before.secret;
    if (before.test === undefined) delete process.env.CARD_TEST_PROVIDER;
    if (before.secret === undefined) delete process.env.APP_SECRET;
  });
});

describe("račun i povraćaj", () => {
  it("PDV sadržan u iznosu", () => {
    expect(includedTax(12000, 20)).toBe(2000);
    expect(includedTax(11000, 10)).toBe(1000);
    expect(includedTax(999, 20)).toBe(167);
    expect(includedTax(5000, 0)).toBe(0);
  });

  it("može da se vrati najviše ono što je ostalo", () => {
    expect(refundable({ total: 5000, refunded: 0 })).toBe(5000);
    expect(refundable({ total: 5000, refunded: 1200 })).toBe(3800);
    expect(refundable({ total: 5000, refunded: 5000 })).toBe(0);
  });
});

describe("poruka o statusu", () => {
  const order = { number: "1042", customer: { name: "Ana Anić" }, tracking: { number: "PE123", url: "https://kurir.rs/p/PE123" } } as Order;

  it("upisuje podatke porudžbine u tekst", () => {
    expect(fillStatusText("Zdravo {ime}, porudžbina #{broj} je poslata. {pracenje}", order, "Demo")).toBe(
      "Zdravo Ana, porudžbina #1042 je poslata. Broj pošiljke: PE123 — praćenje: https://kurir.rs/p/PE123.",
    );
    expect(fillStatusText("{prodavnica}: {nepoznato}", order, "Demo")).toBe("Demo: {nepoznato}");
  });

  it("bez broja pošiljke rečenica o praćenju nestaje", () => {
    expect(fillStatusText("Poslato. {pracenje}", { ...order, tracking: undefined }, "Demo")).toBe("Poslato.");
  });
});

describe("račun u PDF-u", () => {
  const order = {
    number: "1042",
    receivedAt: "2026-10-12T10:00:00.000Z",
    status: "new",
    customerKey: "t641234567",
    customer: { name: "Đorđe Šćepanović", phone: "064 123 4567", email: "djordje@example.com", street: "Čika Ljubina 5", city: "Čačak", postalCode: "32000", note: "" },
    items: Array.from({ length: 45 }, (_, index) => ({ slug: `p${index}`, name: `Šolja za čaj ${index + 1}`, variant: index % 2 ? "Žuta, Mala" : "", sku: `SKU-${index}`, qty: 2, price: 1250, returned: 0 })),
    paymentMethod: "bank",
    deliveryMethod: "Kurirska služba",
    pickup: false,
    refunded: 500,
    taxPercent: 20,
    subtotal: 112500,
    delivery: 500,
    total: 113000,
    discount: { code: "LETO", percent: 10, amount: 0 },
  } as Order;

  it("pravi ispravan PDF, i kada stavke prelaze na više strana", async () => {
    const settings = mergeSettings({ store: { ...defaultSettings.store, name: "Šešir d.o.o.", legal: "Šešir d.o.o.\nPIB 123456789" }, tax: { enabled: true, percent: 20, invoiceEmail: "order" } });
    const pdf = await invoicePdf(order, settings);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-6).toString()).toContain("%%EOF");
    // 45 stavki ne staje na jednu stranu A4.
    expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(invoiceFileName(order)).toBe("racun-1042.pdf");
  });

  it("podešavanja računa i podsetnika se svode na dozvoljene vrednosti", () => {
    const settings = mergeSettings({ tax: { enabled: true, percent: 250, invoiceEmail: "uvek" as never }, abandoned: { enabled: true, delayHours: 0, subject: "x", text: "y" } });
    expect(settings.tax).toEqual({ enabled: true, percent: 100, invoiceEmail: "none" });
    expect(settings.abandoned.delayHours).toBe(3);
    expect(mergeSettings({ abandoned: { ...defaultSettings.abandoned, delayHours: 9999 } }).abandoned.delayHours).toBe(168);
    expect(defaultSettings.abandoned.enabled).toBe(false);
    expect(defaultSettings.mail.statusEmails.refunded.enabled).toBe(true);
  });

  it("u poruci o povraćaju stoji iznos", () => {
    expect(fillStatusText("Vraćamo vam {iznos} za #{broj}.", order, "Šešir", { iznos: "500 RSD" })).toBe("Vraćamo vam 500 RSD za #1042.");
  });
});
