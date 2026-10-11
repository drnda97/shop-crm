import type { Product } from "@/lib/catalog";
import type { Discount } from "@/lib/discounts";
import type { OrderCustomer } from "@/lib/orders";

/** Objavljen proizvod na stanju; test menja samo ono što proverava. */
export function product(change: Partial<Product> = {}): Product {
  return {
    slug: "stolica",
    name: "Stolica",
    sku: "",
    category: "",
    active: true,
    summary: "",
    description: "",
    attributes: [],
    price: 10000,
    salePrice: null,
    weight: null,
    inStock: true,
    stockQty: null,
    lowStockMode: "off",
    lowStockThreshold: null,
    gallery: [],
    options: [],
    variants: [],
    highlight: { heading: "", text: "", specs: [] },
    ...change,
  };
}

export function discount(change: Partial<Discount> = {}): Discount {
  return {
    id: "popust",
    name: "Popust",
    code: "",
    percent: 10,
    status: "active",
    trigger: "amount",
    threshold: 0,
    maxUses: null,
    expiresAt: null,
    ...change,
  };
}

export function customer(change: Partial<OrderCustomer> = {}): OrderCustomer {
  return {
    name: "Petar Petrović",
    phone: "064 123 4567",
    email: "petar@example.com",
    street: "Glavna 1",
    city: "Beograd",
    postalCode: "11000",
    note: "",
    ...change,
  };
}
