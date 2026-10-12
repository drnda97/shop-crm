import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/orders";
import { buildReport, isDay, reportPeriod } from "@/lib/reports";
import { ratingSummary } from "@/lib/reviews";
import { mergeSettings } from "@/lib/settings";

function order(change: Partial<Order>): Order {
  return {
    number: "1",
    receivedAt: "2026-10-05T10:00:00.000Z",
    status: "new",
    customerKey: "t1",
    customer: { name: "A", phone: "1", email: "a@b.rs", street: "", city: "", postalCode: "", note: "" },
    items: [{ slug: "stolica", name: "Stolica", variant: "", sku: "", qty: 2, price: 5000, returned: 0 }],
    paymentMethod: "cod",
    deliveryMethod: "Kurir",
    pickup: false,
    refunded: 0,
    taxPercent: null,
    subtotal: 10000,
    delivery: 500,
    total: 10500,
    ...change,
  };
}

describe("izveštaj o prodaji", () => {
  const orders = [
    order({ number: "1" }),
    order({ number: "2", receivedAt: "2026-10-05T23:30:00.000Z", paymentMethod: "bank", discount: { code: "LETO", percent: 10, amount: 1000, label: "", freeShipping: false }, total: 9500 }),
    order({ number: "3", receivedAt: "2026-10-07T09:00:00.000Z", refunded: 2000, items: [{ slug: "stolica", name: "Stolica", variant: "Crna", sku: "", qty: 1, price: 10000, returned: 0 }] }),
    order({ number: "4", receivedAt: "2026-10-07T09:00:00.000Z", status: "cancelled" }),
    order({ number: "5", receivedAt: "2026-09-30T09:00:00.000Z" }),
  ];
  const report = buildReport(orders, { from: "2026-10-01", to: "2026-10-31" }, "Europe/Belgrade");

  it("sabira period, bez otkazanih i bez porudžbina van perioda", () => {
    expect(report).toMatchObject({ orders: 3, cancelled: 1, pieces: 5, delivery: 1500, discounts: 1000, refunded: 2000 });
    // 10000 + (10000 − 1000) + (10000 − 2000)
    expect(report.sales).toBe(27000);
    expect(report.revenue).toBe(10500 + 9500 + 10500 - 2000);
    expect(report.average).toBe(9000);
  });

  it("dan se računa po vremenu prodavnice: 23:30 UTC je već sutra u Beogradu", () => {
    expect(report.days).toEqual([
      { day: "2026-10-05", orders: 1, sales: 10000 },
      { day: "2026-10-06", orders: 1, sales: 9000 },
      { day: "2026-10-07", orders: 1, sales: 8000 },
    ]);
  });

  it("razlaže po proizvodu (sa varijantom), plaćanju, dostavi i popustu", () => {
    expect(report.products).toEqual([
      { label: "Stolica", orders: 2, qty: 4, amount: 20000 },
      { label: "Stolica — Crna", orders: 1, qty: 1, amount: 10000 },
    ]);
    expect(report.payments.map((row) => [row.label, row.orders])).toEqual([["Plaćanje pouzećem", 2], ["Uplata na račun", 1]]);
    expect(report.deliveries).toEqual([{ label: "Kurir", orders: 3, qty: 5, amount: 1500 }]);
    expect(report.discountsUsed).toEqual([{ label: "Popust 10% (kod LETO)", orders: 1, qty: 2, amount: 1000 }]);
  });

  it("prazan period ne deli nulom", () => {
    expect(buildReport(orders, { from: "2025-01-01", to: "2025-01-31" }, "Europe/Belgrade")).toMatchObject({ orders: 0, sales: 0, average: null, days: [] });
  });

  it("period iz adrese: neispravan datum daje poslednjih 30 dana", () => {
    const now = new Date("2026-10-12T08:00:00.000Z");
    expect(reportPeriod(undefined, undefined, "Europe/Belgrade", now)).toEqual({ from: "2026-09-13", to: "2026-10-12" });
    expect(reportPeriod("2026-10-01", "2026-10-05", "Europe/Belgrade", now)).toEqual({ from: "2026-10-01", to: "2026-10-05" });
    expect(reportPeriod("2026-11-01", "2026-10-05", "Europe/Belgrade", now).from).toBe("2026-09-06");
    expect(isDay("2026-13-45")).toBe(false);
    expect(isDay("'; DROP")).toBe(false);
  });
});

describe("utisci i analitika", () => {
  it("prosečna ocena na jednu decimalu", () => {
    expect(ratingSummary([])).toBeNull();
    expect(ratingSummary([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toEqual({ average: 4.3, count: 3 });
  });

  it("oznake za analitiku prolaze samo u tačnom obliku", () => {
    expect(mergeSettings({ analytics: { ga4: "G-ABC123DEF4", metaPixel: "123456789012345" } }).analytics).toEqual({ ga4: "G-ABC123DEF4", metaPixel: "123456789012345" });
    expect(mergeSettings({ analytics: { ga4: "G-1');alert(1)//", metaPixel: "12<script>" } }).analytics).toEqual({ ga4: "", metaPixel: "" });
  });
});
