import { randomInt } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { after } from "next/server";
import { findStockProblem, getPricing, getWeight, toLines } from "@/lib/cart";
import { currentPrice, variantLabel } from "@/lib/catalog";
import { getDiscounts, getProducts, getSettings, withContentLock } from "@/lib/content";
import { getDb } from "@/lib/db";
import { isExpired, normalizeCode, pickDiscount, type AppliedDiscount } from "@/lib/discounts";
import { notifyOrder } from "@/lib/order-email";
import {
  customerKey,
  parseOrder,
  phoneDigits,
  validateCustomer,
  type Order,
  type OrderResult,
  type OrderStatus,
} from "@/lib/orders";
import { enabledPayments, type PaymentMethod, type Settings } from "@/lib/settings";

/**
 * Porudžbine i kodovi za popust: upis pri poručivanju i čitanje za admin panel.
 * U bazi su u tabelama `orders`, `order_items` i `discount_codes` (lib/db.ts).
 * Samo za server.
 */

function toOrder(row: RowDataPacket, items: RowDataPacket[]): Order {
  return {
    number: String(row.number),
    receivedAt: (row.received_at as Date).toISOString(),
    status: row.status,
    customerKey: row.customer_key,
    customer: {
      name: row.customer_name,
      phone: row.phone,
      email: row.email,
      street: row.street,
      city: row.city,
      postalCode: row.postal_code,
      note: row.note,
    },
    items: items
      .filter((item) => item.order_number === row.number)
      .map((item) => ({
        slug: item.slug,
        name: item.name,
        variant: item.variant,
        sku: item.sku,
        qty: item.qty,
        price: item.price,
      })),
    paymentMethod: row.payment_method,
    subtotal: row.subtotal,
    delivery: row.delivery,
    total: row.total,
    ...(row.discount_code === null
      ? {}
      : {
          discount: {
            code: row.discount_code,
            percent: row.discount_percent,
            amount: row.discount_amount,
          },
        }),
    ...(row.issued_code === null
      ? {}
      : {
          issuedCode: {
            code: row.issued_code,
            percent: row.issued_percent,
            title: row.issued_title ?? "",
          },
        }),
    ...(row.email_error === null ? {} : { emailError: row.email_error }),
    ...(row.admin_note ? { adminNote: row.admin_note } : {}),
  };
}

/** Najstarija prva. */
export async function getOrders(): Promise<Order[]> {
  const db = await getDb();
  const [orders] = await db.query<RowDataPacket[]>("SELECT * FROM orders ORDER BY number");
  const [items] = await db.query<RowDataPacket[]>(
    "SELECT * FROM order_items ORDER BY order_number, position",
  );
  return orders.map((row) => toOrder(row, items));
}

/** Koliko porudžbina čeka obradu (nove); za oznaku u meniju panela. */
export async function countNewOrders(): Promise<number> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT COUNT(*) AS waiting FROM orders WHERE status = 'new'");
  return Number(rows[0].waiting);
}

/**
 * Menja status porudžbine. Otkazivanje vraća komade na stanje, a vraćanje
 * otkazane porudžbine ih ponovo skida — samo kod proizvoda kojima se vodi broj.
 */
export async function setOrderStatus(number: string, status: OrderStatus) {
  await withContentLock(async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT status FROM orders WHERE number = ?",
      [number],
    );
    if (rows.length === 0 || rows[0].status === status) return;

    const wasCancelled = rows[0].status === "cancelled";
    const isCancelled = status === "cancelled";
    if (wasCancelled !== isCancelled) {
      const [items] = await connection.query<RowDataPacket[]>(
        "SELECT slug, qty FROM order_items WHERE order_number = ?",
        [number],
      );
      for (const item of items) {
        await connection.query(
          isCancelled
            ? "UPDATE products SET stock_qty = stock_qty + ? WHERE slug = ? AND stock_qty IS NOT NULL"
            : "UPDATE products SET stock_qty = GREATEST(stock_qty - ?, 0) WHERE slug = ? AND stock_qty IS NOT NULL",
          [item.qty, item.slug],
        );
      }
    }
    await connection.query("UPDATE orders SET status = ? WHERE number = ?", [status, number]);
  });
}

export async function setOrderNote(number: string, note: string) {
  await (
    await getDb()
  ).query("UPDATE orders SET admin_note = ? WHERE number = ?", [note || null, number]);
}

/** Koliko je kodova poslato i iskorišćeno po pravilu nagrade, za admin panel. */
export async function getCodeCounts(): Promise<Record<string, { sent: number; used: number }>> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>(
    "SELECT discount_id, COUNT(*) AS sent, COUNT(used_order) AS used FROM discount_codes GROUP BY discount_id",
  );
  return Object.fromEntries(
    rows.map((row) => [row.discount_id, { sent: Number(row.sent), used: Number(row.used) }]),
  );
}

/** Koliko je porudžbina iskoristilo koji kod (bez otkazanih); za promo kodove. */
export async function getCodeUses(): Promise<Record<string, number>> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>(
    `SELECT discount_code, COUNT(*) AS used FROM orders
     WHERE discount_code IS NOT NULL AND status <> 'cancelled' GROUP BY discount_code`,
  );
  return Object.fromEntries(rows.map((row) => [row.discount_code, Number(row.used)]));
}

async function countUses(db: PoolConnection | Awaited<ReturnType<typeof getDb>>, code: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS used FROM orders WHERE discount_code = ? AND status <> 'cancelled'",
    [code],
  );
  return Number(rows[0].used);
}

const CODE_PROBLEM = "Kod nije ispravan ili je već iskorišćen.";

/** Kod koji porudžbina koristi: promo kod (issuedId null) ili kod poslat kupcu. */
type ResolvedCode = AppliedDiscount & { issuedId: number | null; maxUses: number | null };

/** Aktivan promo kod koji još važi, ili null. */
async function findPublicCode(code: string, settings: Settings): Promise<ResolvedCode | null> {
  const discount = (await getDiscounts()).find(
    (candidate) =>
      candidate.trigger === "public" && candidate.status === "active" && candidate.code === code,
  );
  if (!discount || isExpired(discount, settings.store.timeZone)) return null;
  if (discount.maxUses !== null && (await countUses(await getDb(), code)) >= discount.maxUses) {
    return null;
  }
  return { code, percent: discount.percent, issuedId: null, maxUses: discount.maxUses };
}

/** Neiskorišćena slanja datog koda, najstarije prvo. */
async function findUnusedCodes(code: string): Promise<RowDataPacket[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>(
    "SELECT id, code, percent, email, phone FROM discount_codes WHERE code = ? AND used_order IS NULL ORDER BY id",
    [code],
  );
  return rows;
}

export type CodeCheck = { ok: true; discount: AppliedDiscount } | { ok: false; message: string };

/**
 * Provera koda u korpi, gde se još ne zna ko je kupac: prolazi promo kod koji
 * važi, ili kod koji je nekome poslat i još nije iskorišćen. Da li je poslat baš
 * ovom kupcu proverava se pri poručivanju (resolveCode).
 */
export async function checkCode(input: unknown): Promise<CodeCheck> {
  const code = typeof input === "string" ? normalizeCode(input) : "";
  if (code === "" || code.length > 32) return { ok: false, message: CODE_PROBLEM };

  const promo = await findPublicCode(code, await getSettings());
  if (promo) return { ok: true, discount: { code: promo.code, percent: promo.percent } };
  const rows = await findUnusedCodes(code);
  return rows.length > 0
    ? { ok: true, discount: { code: rows[0].code, percent: rows[0].percent } }
    : { ok: false, message: CODE_PROBLEM };
}

/** Kod poslat kao nagrada važi samo za kupca kome je poslat: isti email ili isti broj telefona. */
async function resolveCode(
  code: string,
  customer: { email: string; phone: string },
  settings: Settings,
): Promise<ResolvedCode | null> {
  if (code.length > 32) return null;
  const promo = await findPublicCode(code, settings);
  if (promo) return promo;

  const prefix = settings.store.phonePrefix;
  const row = (await findUnusedCodes(code)).find(
    (candidate) =>
      candidate.email.toLowerCase() === customer.email.toLowerCase() ||
      (candidate.phone !== "" &&
        phoneDigits(candidate.phone, prefix) === phoneDigits(customer.phone, prefix)),
  );
  return row ? { code: row.code, percent: row.percent, issuedId: row.id, maxUses: null } : null;
}

// Bez slova i cifara koje se lako pomešaju (0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(prefix: string): string {
  const start = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "") || "KOD";
  let code = `${start.slice(0, 12)}-`;
  for (let index = 0; index < 6; index++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Početak napomene porudžbine koju kupac preuzima u salonu. */
export const PICKUP_NOTE = "Preuzimanje u salonu.";

class CodeAlreadyUsed extends Error {}
class OutOfStock extends Error {}

/**
 * Upisuje porudžbinu u jednoj transakciji: stavke, skidanje sa stanja,
 * potrošnju upisanog koda i novi kod za sledeću kupovinu. Broj porudžbine dodeljuje baza.
 */
async function insertOrder(
  order: Omit<Order, "number" | "issuedCode">,
  /** Šta se skida sa stanja: proizvod, ili njegova varijanta. */
  stock: { slug: string; variantId?: string; qty: number }[],
  weight: number,
  usedCode: ResolvedCode | null,
  settings: Settings,
): Promise<Order> {
  const discounts = await getDiscounts();
  return withContentLock(async (connection) => {
    const { customer } = order;

    // Prva porudžbina: isti kupac (po telefonu ili emailu) do sada nije poručivao.
    // Otkazane porudžbine se ne računaju.
    const [earlier] = await connection.query<RowDataPacket[]>(
      `SELECT 1 FROM orders
       WHERE status <> 'cancelled' AND (customer_key = ? OR LOWER(email) = ?) LIMIT 1`,
      [order.customerKey, customer.email.toLowerCase()],
    );
    const isFirstOrder = earlier.length === 0;

    // Promo kod sa ograničenim brojem korišćenja: pod zaključavanjem, da dve
    // porudžbine u istom trenutku ne potroše isto poslednje mesto.
    if (usedCode && usedCode.issuedId === null && usedCode.maxUses !== null) {
      if ((await countUses(connection, usedCode.code)) >= usedCode.maxUses) {
        throw new CodeAlreadyUsed();
      }
    }

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO orders (received_at, status, customer_key, customer_name, phone, email, street,
        city, postal_code, note, payment_method, subtotal, delivery, total, discount_code,
        discount_percent, discount_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        new Date(order.receivedAt),
        order.status,
        order.customerKey,
        customer.name,
        customer.phone,
        customer.email,
        customer.street,
        customer.city,
        customer.postalCode,
        customer.note,
        order.paymentMethod,
        order.subtotal,
        order.delivery,
        order.total,
        order.discount?.code ?? null,
        order.discount?.percent ?? null,
        order.discount?.amount ?? 0,
      ],
    );
    const number = result.insertId;
    await connection.query(
      "INSERT INTO order_items (order_number, position, slug, name, variant, sku, qty, price) VALUES ?",
      [
        order.items.map((item, index) => [
          number,
          index,
          item.slug,
          item.name,
          item.variant,
          item.sku,
          item.qty,
          item.price,
        ]),
      ],
    );

    // Skidanje sa stanja, samo tamo gde se vodi broj komada: kod varijante sa njenog stanja,
    // inače sa stanja proizvoda. Uslov u upitu čuva od toga da dve porudžbine u istom trenutku
    // prodaju isti poslednji komad.
    for (const { slug, variantId, qty } of stock) {
      const [table, where, key] = variantId
        ? ["product_variants", "product_slug = ? AND id = ?", [slug, variantId]]
        : ["products", "slug = ?", [slug]];
      const [tracked] = await connection.query<RowDataPacket[]>(
        `SELECT stock_qty FROM ${table} WHERE ${where}`,
        key,
      );
      if (tracked.length === 0 || tracked[0].stock_qty === null) continue;
      const [taken] = await connection.query<ResultSetHeader>(
        `UPDATE ${table} SET stock_qty = stock_qty - ? WHERE ${where} AND stock_qty >= ?`,
        [qty, ...key, qty],
      );
      if (taken.affectedRows === 0) throw new OutOfStock();
    }

    if (usedCode && usedCode.issuedId !== null) {
      // Uslov "used_order IS NULL" čuva od toga da dve porudžbine u istom trenutku potroše isti kod.
      const [used] = await connection.query<ResultSetHeader>(
        "UPDATE discount_codes SET used_order = ?, used_at = ? WHERE id = ? AND used_order IS NULL",
        [number, new Date(), usedCode.issuedId],
      );
      if (used.affectedRows === 0) throw new CodeAlreadyUsed();
    }

    // Kod za sledeću kupovinu: najjača aktivna nagrada čiji uslov ova porudžbina ispunjava.
    const rule = pickDiscount(discounts, {
      isFirstOrder,
      amount: order.subtotal - (order.discount?.amount ?? 0),
      weight,
    });
    let issuedCode: Order["issuedCode"];
    if (rule) {
      // Kod koji je vlasnik upisao uz nagradu; ako ga nema, nasumičan kod samo za ovog kupca.
      issuedCode = {
        code: rule.code || generateCode(settings.store.codePrefix),
        percent: rule.percent,
        title: rule.name,
      };
      await connection.query(
        `INSERT INTO discount_codes (code, discount_id, discount_name, percent, issued_order, email,
          phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          issuedCode.code,
          rule.id,
          rule.name,
          rule.percent,
          number,
          customer.email,
          customer.phone,
          new Date(),
        ],
      );
      await connection.query(
        "UPDATE orders SET issued_code = ?, issued_percent = ?, issued_title = ? WHERE number = ?",
        [issuedCode.code, issuedCode.percent, issuedCode.title, number],
      );
    }

    return { ...order, number: String(number), ...(issuedCode ? { issuedCode } : {}) };
  });
}

/**
 * Jedino mesto kroz koje prolazi porudžbina: proverava podatke na serveru i
 * čuva porudžbinu, koja se zatim vidi u admin panelu. Posle upisa šalje email
 * prodavcu i kupcu, prema podešavanjima u panelu (lib/order-email.ts).
 */
export async function submitOrder(input: unknown): Promise<OrderResult> {
  const { customer, items, discountCode, paymentMethod, deliveryMethod } = parseOrder(input);

  const errors = validateCustomer(customer);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const settings = await getSettings();
  const payments = enabledPayments(settings);
  const payment = payments.find((method) => method === paymentMethod) as PaymentMethod | undefined;
  if (paymentMethod !== "" && !payment) {
    return { ok: false, errors: {}, message: "Izabrani način plaćanja nije dostupan." };
  }
  const pickup = deliveryMethod === "pickup";
  if (pickup && !settings.shipping.pickupEnabled) {
    return { ok: false, errors: {}, message: "Preuzimanje u salonu nije dostupno." };
  }

  // Cene i stanje se uzimaju iz proizvoda na serveru, nikad iz onoga što pošalje sajt.
  const products = await getProducts();
  const stockProblem = findStockProblem(items, products);
  if (stockProblem) return { ok: false, errors: {}, message: stockProblem };
  const lines = toLines(items, products);
  if (lines.length === 0) {
    return {
      ok: false,
      errors: {},
      message: "Korpa je prazna. Dodajte proizvode pa pokušajte ponovo.",
    };
  }

  const codeProblem: OrderResult = {
    ok: false,
    errors: {},
    message:
      "Kod za popust ne važi za ovu porudžbinu: nije poslat na upisani email ili telefon, istekao je ili je već iskorišćen. Uklonite kod pa potvrdite ponovo.",
  };
  const applied = discountCode ? await resolveCode(discountCode, customer, settings) : null;
  if (discountCode && !applied) return codeProblem;

  const { shipping } = settings;
  const pricing = getPricing(lines, {
    discountPercent: applied?.percent,
    deliveryPrice: pickup ? 0 : shipping.price,
    freeShippingFrom: shipping.freeEnabled ? shipping.freeFrom : null,
  });
  const useCode = applied && pricing.discount > 0 ? applied : null;

  let order: Order;
  try {
    order = await insertOrder(
      {
        receivedAt: new Date().toISOString(),
        status: "new",
        customerKey: customerKey(customer, settings.store.phonePrefix),
        // Preuzimanje se upisuje u napomenu, pa ga prodavac vidi u panelu i u emailu.
        customer: pickup ? { ...customer, note: `${PICKUP_NOTE} ${customer.note}`.trim() } : customer,
        items: lines.map((line) => ({
          slug: line.product.slug,
          name: line.product.name,
          variant: line.variant ? variantLabel(line.variant) : "",
          // Šifra varijante, ako je upisana; inače šifra proizvoda.
          sku: line.variant?.sku || line.product.sku,
          qty: line.qty,
          // Cena u trenutku poručivanja: akcijska ako akcija važi.
          price: currentPrice(line.product, line.variant) ?? 0,
        })),
        paymentMethod: payment ?? payments[0],
        subtotal: pricing.subtotal,
        delivery: pricing.delivery,
        total: pricing.total,
        ...(useCode
          ? { discount: { code: useCode.code, percent: useCode.percent, amount: pricing.discount } }
          : {}),
      },
      lines.map((line) => ({ slug: line.product.slug, variantId: line.variant?.id, qty: line.qty })),
      getWeight(lines),
      useCode,
      settings,
    );
  } catch (error) {
    if (error instanceof CodeAlreadyUsed) return codeProblem;
    if (error instanceof OutOfStock) {
      return {
        ok: false,
        errors: {},
        message:
          "Neko je upravo poručio poslednje komade nečega iz vaše korpe. Proverite korpu pa potvrdite ponovo.",
      };
    }
    throw error;
  }

  // Email se šalje pošto kupac dobije odgovor, da spor mail server ne zadržava poručivanje.
  // Porudžbina je već sačuvana; ako slanje ne uspe, razlog se upisuje uz nju i vidi u panelu.
  after(async () => {
    const error = await notifyOrder(order).catch((reason) => String(reason));
    if (error) {
      console.error(`[porudžbina ${order.number}] email nije poslat: ${error}`);
      await (
        await getDb()
      ).query("UPDATE orders SET email_error = ? WHERE number = ?", [error, order.number]);
    }
  });

  return {
    ok: true,
    orderNumber: order.number,
    total: order.total,
    paymentMethod: order.paymentMethod,
    ...(order.paymentMethod === "bank" && settings.payment.bankInstructions
      ? { paymentInstructions: settings.payment.bankInstructions }
      : {}),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vrednost proizvoda u porudžbini, posle popusta i bez dostave. */
function itemsValue(order: Order): number {
  return order.subtotal - (order.discount?.amount ?? 0);
}

function pieces(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.qty, 0);
}

function summarize(orders: Order[]) {
  const sales = orders.reduce((sum, order) => sum + itemsValue(order), 0);
  return {
    orders: orders.length,
    /** Vrednost prodatih proizvoda, bez dostave. */
    sales,
    pieces: orders.reduce((sum, order) => sum + pieces(order), 0),
    average: orders.length > 0 ? Math.round(sales / orders.length) : null,
  };
}

/** Brojke za početnu stranu panela. Otkazane porudžbine se ne računaju u prodaju. */
export function getSalesStats(orders: Order[], timeZone: string, now = new Date()) {
  // Dan po vremenu prodavnice, npr. "2026-10-03".
  const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone });
  const dayKey = (date: Date) => dayKeyFormat.format(date);

  const valid = orders.filter((order) => order.status !== "cancelled");
  const since = (days: number) => now.getTime() - days * DAY_MS;
  const between = (from: number, to: number) =>
    valid.filter((order) => {
      const time = new Date(order.receivedAt).getTime();
      return time >= from && time < to;
    });

  // Poslednjih 30 dana, dan po dan, uključujući dane bez porudžbina.
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(now.getTime() - (29 - index) * DAY_MS);
    return { key: dayKey(date), date, orders: 0, sales: 0 };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));
  for (const order of valid) {
    const day = byDay.get(dayKey(new Date(order.receivedAt)));
    if (day) {
      day.orders += 1;
      day.sales += itemsValue(order);
    }
  }

  const products = new Map<
    string,
    { slug: string; name: string; qty: number; sales: number; orders: number }
  >();
  const cities = new Map<string, { name: string; orders: number }>();
  const customers = new Map<string, number>();
  for (const order of valid) {
    for (const item of order.items) {
      const entry = products.get(item.slug) ?? {
        slug: item.slug,
        name: item.name,
        qty: 0,
        sales: 0,
        orders: 0,
      };
      entry.name = item.name;
      entry.qty += item.qty;
      entry.sales += item.price * item.qty;
      entry.orders += 1;
      products.set(item.slug, entry);
    }
    const cityKey = order.customer.city.trim().toLocaleLowerCase();
    const city = cities.get(cityKey) ?? { name: order.customer.city.trim(), orders: 0 };
    city.orders += 1;
    cities.set(cityKey, city);
    customers.set(order.customerKey, (customers.get(order.customerKey) ?? 0) + 1);
  }

  return {
    all: summarize(valid),
    last30: summarize(between(since(30), Infinity)),
    previous30: summarize(between(since(60), since(30))),
    last7: summarize(between(since(7), Infinity)),
    days,
    topProducts: [...products.values()].sort((a, b) => b.qty - a.qty || b.sales - a.sales),
    topCities: [...cities.values()].sort((a, b) => b.orders - a.orders),
    customers: customers.size,
    returningCustomers: [...customers.values()].filter((count) => count > 1).length,
    waiting: orders.filter((order) => order.status === "new").length,
    cancelled: orders.length - valid.length,
  };
}
