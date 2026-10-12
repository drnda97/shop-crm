import { getShopLang } from "@/lib/i18n/server";
import { randomInt } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { after } from "next/server";
import { findStockProblem, getPricing, getWeight, toLines, type CartLine, type Pricing } from "@/lib/cart";
import { currentPrice, variantLabel } from "@/lib/catalog";
import { getCategories, getDiscounts, getProducts, getSettings, withContentLock } from "@/lib/content";
import { getDb } from "@/lib/db";
import {
  applyRule,
  isExpired,
  normalizeCode,
  percentRule,
  pickDiscount,
  saving,
  type AppliedDiscount,
  type Discount,
  type DiscountEffect,
  type DiscountRule,
} from "@/lib/discounts";
import { notifyOrder } from "@/lib/order-email";
import {
  customerKey,
  orderStatusLabels,
  parseOrder,
  phoneDigits,
  validateCustomer,
  type Order,
  type OrderCustomer,
  type OrderEvent,
  type OrderResult,
  type OrderStatus,
} from "@/lib/orders";
import { emitOrderEvent } from "@/lib/integrations";
import { cardProvider } from "@/lib/payments";
import { enabledPayments, type PaymentMethod, type Settings } from "@/lib/settings";
import { availableMethods, basePrice, type ShippingMethod } from "@/lib/shipping";
import { siteUrl } from "@/lib/storefront/pages";
import { logStock, type StockChange } from "@/lib/stock";

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
        returned: item.returned ?? 0,
      })),
    paymentMethod: row.payment_method,
    deliveryMethod: row.delivery_method ?? "",
    pickup: row.pickup === 1,
    ...(row.tracking_number ? { tracking: { number: row.tracking_number, url: row.tracking_url ?? "" } } : {}),
    ...(row.paid_at ? { paidAt: (row.paid_at as Date).toISOString() } : {}),
    ...(row.payment_ref ? { paymentRef: row.payment_ref } : {}),
    refunded: row.refunded ?? 0,
    taxPercent: row.tax_percent == null ? null : Number(row.tax_percent),
    subtotal: row.subtotal,
    delivery: row.delivery,
    total: row.total,
    // Automatski popust nema kod, pa se popust prepoznaje i po upisanom naslovu.
    ...(row.discount_code === null && !row.discount_name
      ? {}
      : {
          discount: {
            code: row.discount_code ?? "",
            percent: row.discount_percent,
            amount: row.discount_amount,
            label: row.discount_name ?? "",
            freeShipping: row.discount_shipping === 1,
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
    ...(row.lang ? { lang: row.lang } : {}),
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

export async function getOrder(number: string): Promise<Order | null> {
  if (!/^\d{1,10}$/.test(number)) return null;
  const db = await getDb();
  const [orders] = await db.query<RowDataPacket[]>("SELECT * FROM orders WHERE number = ?", [number]);
  if (orders.length === 0) return null;
  const [items] = await db.query<RowDataPacket[]>(
    "SELECT * FROM order_items WHERE order_number = ? ORDER BY position",
    [number],
  );
  return toOrder(orders[0], items);
}

/* ---------- Istorija porudžbine ---------- */

type Queryable = Pick<PoolConnection, "query">;

/** Dodaje red u istoriju porudžbine: šta se desilo i kada. */
export async function addOrderEvent(db: Queryable, number: string | number, text: string) {
  await db.query("INSERT INTO order_events (order_number, at, text) VALUES (?, ?, ?)", [
    number,
    new Date(),
    text.slice(0, 500),
  ]);
}

/** Istorija porudžbine, najnovije prvo. */
export async function getOrderEvents(number: string): Promise<OrderEvent[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT at, text FROM order_events WHERE order_number = ? ORDER BY id DESC", [
    number,
  ]);
  return rows.map((row) => ({ at: (row.at as Date).toISOString(), text: row.text }));
}

/* ---------- Praćenje, uplata, povraćaj, podaci kupca ---------- */

export async function setOrderTracking(number: string, tracking: { number: string; url: string }) {
  const db = await getDb();
  await db.query("UPDATE orders SET tracking_number = ?, tracking_url = ? WHERE number = ?", [
    tracking.number,
    tracking.url,
    number,
  ]);
  await addOrderEvent(db, number, tracking.number ? `Upisan broj pošiljke ${tracking.number}` : "Broj pošiljke je uklonjen");
}

/**
 * Označava porudžbinu kao plaćenu ili neplaćenu. Vraća false kada se ništa nije promenilo
 * (npr. procesor je istu uplatu potvrdio dva puta), da se događaj ne upiše dvaput.
 */
export async function setOrderPaid(number: string, paid: boolean, note: string, reference = ""): Promise<boolean> {
  const db = await getDb();
  // Uslov u upitu: ista potvrda koja stigne dva puta menja porudžbinu samo jednom.
  const [changed] = paid
    ? await db.query<ResultSetHeader>(
        "UPDATE orders SET paid_at = ?, payment_ref = ? WHERE number = ? AND paid_at IS NULL",
        [new Date(), reference, number],
      )
    : await db.query<ResultSetHeader>(
        "UPDATE orders SET paid_at = NULL WHERE number = ? AND paid_at IS NOT NULL",
        [number],
      );
  if (changed.affectedRows === 0) return false;
  await addOrderEvent(db, number, note);
  if (paid) emitOrderEvent("order.paid", number);
  return true;
}

/**
 * Povraćaj: beleži iznos vraćen kupcu i, ako je kupac vratio robu, vraća te komade na stanje.
 * `returns` su stavke po rednom broju sa brojem vraćenih komada. Sam novac vraća prodavac (ili
 * procesor kartica); ovde je evidencija. Vraća false kada iznos prelazi ono što je ostalo.
 */
export async function refundOrder(
  number: string,
  amount: number,
  reason: string,
  returns: { position: number; qty: number }[] = [],
): Promise<boolean> {
  const done = await withContentLock(async (connection) => {
    // Uslov u upitu: zbir povraćaja ne može da pređe iznos porudžbine, ni kada stignu dva odjednom.
    const [changed] = await connection.query<ResultSetHeader>(
      "UPDATE orders SET refunded = refunded + ? WHERE number = ? AND refunded + ? <= total",
      [amount, number, amount],
    );
    if (changed.affectedRows === 0) return false;

    const [status] = await connection.query<RowDataPacket[]>("SELECT status FROM orders WHERE number = ?", [number]);
    const stock: StockChange[] = [];
    const back: string[] = [];
    for (const entry of returns) {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT slug, name, variant, variant_id, qty, returned FROM order_items WHERE order_number = ? AND position = ?",
        [number, entry.position],
      );
      const item = rows[0];
      const qty = item ? Math.min(entry.qty, item.qty - item.returned) : 0;
      if (qty < 1) continue;
      await connection.query(
        "UPDATE order_items SET returned = returned + ? WHERE order_number = ? AND position = ?",
        [qty, number, entry.position],
      );
      back.push(`${qty} × ${item.variant ? `${item.name} — ${item.variant}` : item.name}`);
      // Otkazana porudžbina je sve komade već vratila na stanje.
      if (status[0]?.status === "cancelled") continue;
      const after = await restock(connection, item.slug, item.variant_id, qty);
      if (after !== undefined) {
        stock.push({ slug: item.slug, variantId: item.variant_id, change: qty, qtyAfter: after, reason: `Povraćaj robe, porudžbina #${number}` });
      }
    }
    await logStock(connection, stock);
    await addOrderEvent(connection, number, back.length > 0 ? `${reason}. Vraćeno na stanje: ${back.join(", ")}` : reason);
    return true;
  });
  if (done) emitOrderEvent("order.refunded", number, { amount });
  return done;
}

/**
 * Vraća (qty > 0) ili skida (qty < 0) komade tamo gde se stanje vodi: sa varijante ili sa
 * proizvoda. Vraća novo stanje, ili undefined kada se broj komada ne vodi.
 */
async function restock(connection: PoolConnection, slug: string, variantId: string, qty: number): Promise<number | undefined> {
  const [table, where, key] = variantId
    ? ["product_variants", "product_slug = ? AND id = ?", [slug, variantId]]
    : ["products", "slug = ?", [slug]];
  const [changed] = await connection.query<ResultSetHeader>(
    `UPDATE ${table} SET stock_qty = GREATEST(stock_qty + ?, 0) WHERE ${where} AND stock_qty IS NOT NULL`,
    [qty, ...key],
  );
  if (changed.affectedRows === 0) return undefined;
  const [now] = await connection.query<RowDataPacket[]>(`SELECT stock_qty FROM ${table} WHERE ${where}`, key);
  return now[0]?.stock_qty;
}

/** Ispravka podataka kupca na porudžbini (adresa, telefon); kupac se i dalje prepoznaje po novim podacima. */
export async function setOrderCustomer(number: string, customer: OrderCustomer, key: string) {
  const db = await getDb();
  await db.query(
    `UPDATE orders SET customer_key = ?, customer_name = ?, phone = ?, email = ?, street = ?, city = ?,
      postal_code = ?, note = ? WHERE number = ?`,
    [key, customer.name, customer.phone, customer.email, customer.street, customer.city, customer.postalCode, customer.note, number],
  );
  await addOrderEvent(db, number, "Izmenjeni podaci kupca");
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
export async function setOrderStatus(number: string, status: OrderStatus): Promise<boolean> {
  let changed = false;
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
        "SELECT slug, variant_id, qty, returned FROM order_items WHERE order_number = ?",
        [number],
      );
      const changes: StockChange[] = [];
      for (const item of items) {
        // Komadi koje je kupac već vratio (povraćaj) su na stanju; menja se samo ostatak.
        const qty = item.qty - item.returned;
        if (qty < 1) continue;
        const after = await restock(connection, item.slug, item.variant_id, isCancelled ? qty : -qty);
        if (after === undefined) continue;
        changes.push({
          slug: item.slug,
          variantId: item.variant_id,
          change: isCancelled ? qty : -qty,
          qtyAfter: after,
          reason: isCancelled ? `Otkazana porudžbina #${number}` : `Vraćena porudžbina #${number}`,
        });
      }
      await logStock(connection, changes);
    }
    await connection.query("UPDATE orders SET status = ? WHERE number = ?", [status, number]);
    await addOrderEvent(connection, number, `Status: ${orderStatusLabels[status]}`);
    changed = true;
  });
  if (changed) emitOrderEvent("order.status", number);
  return changed;
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

/** Koliko je porudžbina (bez otkazanih) iskoristilo promo kod, odnosno automatski popust. */
async function countUses(db: Queryable, used: { code: string; discountId: string | null }) {
  const [rows] = await db.query<RowDataPacket[]>(
    used.code
      ? "SELECT COUNT(*) AS used FROM orders WHERE discount_code = ? AND status <> 'cancelled'"
      : "SELECT COUNT(*) AS used FROM orders WHERE discount_id = ? AND discount_code IS NULL AND status <> 'cancelled'",
    [used.code || used.discountId],
  );
  return Number((rows as RowDataPacket[])[0].used);
}

const CODE_PROBLEM = "Kod nije ispravan ili je već iskorišćen.";

/**
 * Popust koji porudžbina može da iskoristi: promo kod, kod poslat kupcu (issuedId) ili
 * automatski popust (bez koda). `rule` kaže šta daje; koliko, zavisi od korpe (applyRule).
 */
type ResolvedCode = {
  code: string;
  label: string;
  rule: DiscountRule;
  issuedId: number | null;
  maxUses: number | null;
  discountId: string | null;
};

function fromDiscount(discount: Discount): ResolvedCode {
  const { kind, percent, amount, products, categories, threshold } = discount;
  return {
    code: discount.trigger === "public" ? discount.code : "",
    label: discount.name,
    rule: { kind, percent, amount, products, categories, threshold },
    issuedId: null,
    maxUses: discount.maxUses,
    discountId: discount.id,
  };
}

/** Kod poslat kupcu kao nagrada: procenat na celu korpu, za jednu kupovinu. */
function fromIssued(row: RowDataPacket, withId: boolean): ResolvedCode {
  return { code: row.code, label: "", rule: percentRule(row.percent), issuedId: withId ? row.id : null, maxUses: null, discountId: null };
}

/** Aktivan promo kod koji još važi, ili null. */
async function findPublicCode(code: string, settings: Settings): Promise<ResolvedCode | null> {
  const discount = (await getDiscounts()).find(
    (candidate) =>
      candidate.trigger === "public" && candidate.status === "active" && candidate.code === code,
  );
  if (!discount || isExpired(discount, settings.store.timeZone)) return null;
  const resolved = fromDiscount(discount);
  if (discount.maxUses !== null && (await countUses(await getDb(), resolved)) >= discount.maxUses) {
    return null;
  }
  return resolved;
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

export type CodeCheck =
  | { ok: true; discount: { code: string; label: string } & DiscountRule }
  | { ok: false; message: string };

/**
 * Provera koda u korpi, gde se još ne zna ko je kupac: prolazi promo kod koji
 * važi, ili kod koji je nekome poslat i još nije iskorišćen. Da li je poslat baš
 * ovom kupcu proverava se pri poručivanju (resolveCode).
 */
export async function checkCode(input: unknown): Promise<CodeCheck> {
  const found = await findCartCode(input);
  return found
    ? { ok: true, discount: { code: found.code, label: found.label, ...found.rule } }
    : { ok: false, message: CODE_PROBLEM };
}

async function findCartCode(input: unknown): Promise<ResolvedCode | null> {
  const code = typeof input === "string" ? normalizeCode(input) : "";
  if (code === "" || code.length > 32) return null;
  const promo = await findPublicCode(code, await getSettings());
  if (promo) return promo;
  const rows = await findUnusedCodes(code);
  return rows.length > 0 ? fromIssued(rows[0], false) : null;
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
  return row ? fromIssued(row, true) : null;
}

export type Quote = {
  pricing: Pricing;
  /** Popust koji je primenjen: kod kupca ili automatski popust, onaj koji kupcu više štedi. */
  discount: AppliedDiscount | null;
  /** Upisani kod postoji, ali ne važi za ovu korpu (ispod najmanjeg iznosa, ili nema proizvoda na koje se odnosi). */
  codeError: string | null;
};

type InternalQuote = Quote & { used: ResolvedCode | null };

/**
 * Obračun korpe sa popustom: upisani kod se poredi sa automatskim popustima koji važe, i
 * primenjuje se onaj sa većom uštedom (pri istoj, kod kupca). Popusti se ne sabiraju.
 */
async function quoteLines(
  lines: CartLine[],
  code: ResolvedCode | null,
  method: ShippingMethod | undefined,
  settings: Settings,
): Promise<InternalQuote> {
  const [discounts, categories] = await Promise.all([getDiscounts(), getCategories()]);
  const delivery = { deliveryPrice: method ? basePrice(method, getWeight(lines)) : 0, freeShippingFrom: method?.freeFrom ?? null };
  // Dostava bez ikakvog popusta: toliko kupac štedi popustom koji je čini besplatnom.
  const plain = getPricing(lines, delivery);

  const candidates: { used: ResolvedCode; effect: DiscountEffect }[] = [];
  const codeEffect = code ? applyRule(code.rule, lines, categories) : null;
  if (code && codeEffect) candidates.push({ used: code, effect: codeEffect });
  const db = await getDb();
  for (const discount of discounts) {
    if (discount.trigger !== "auto" || discount.status !== "active" || isExpired(discount, settings.store.timeZone)) continue;
    const used = fromDiscount(discount);
    const effect = applyRule(used.rule, lines, categories);
    if (!effect) continue;
    if (discount.maxUses !== null && (await countUses(db, used)) >= discount.maxUses) continue;
    candidates.push({ used, effect });
  }

  let best: { used: ResolvedCode; effect: DiscountEffect } | null = null;
  for (const candidate of candidates) {
    if (!best || saving(candidate.effect, plain.delivery) > saving(best.effect, plain.delivery)) best = candidate;
  }
  // Popust koji ništa ne štedi (npr. besplatna dostava kada je dostava već besplatna) se ne beleži.
  if (best && saving(best.effect, plain.delivery) === 0) best = null;

  const pricing = getPricing(lines, { ...delivery, discount: best?.effect });
  return {
    pricing,
    used: best?.used ?? null,
    discount: best
      ? {
          code: best.used.code,
          label: best.used.label,
          percent: best.used.rule.kind === "percent" ? best.used.rule.percent : null,
          amount: pricing.discount,
          freeShipping: best.effect.freeShipping,
        }
      : null,
    codeError: code && !codeEffect ? "Kod ne važi za ovu korpu: proverite najmanji iznos i proizvode na koje se odnosi." : null,
  };
}

/** Obračun korpe za sajt i API: stavke, upisani kod, način dostave. */
export async function quoteCart(
  lines: CartLine[],
  codeInput: unknown,
  method: ShippingMethod | undefined,
): Promise<Quote> {
  const typed = typeof codeInput === "string" && codeInput.trim() !== "";
  const code = typed ? await findCartCode(codeInput) : null;
  const { pricing, discount, codeError } = await quoteLines(lines, code, method, await getSettings());
  return { pricing, discount, codeError: typed && !code ? CODE_PROBLEM : codeError };
}

// Bez slova i cifara koje se lako pomešaju (0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(prefix: string): string {
  const start = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "") || "KOD";
  let code = `${start.slice(0, 12)}-`;
  for (let index = 0; index < 6; index++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

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
  /** Prvi red istorije: odakle je porudžbina stigla. */
  source: string,
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
      if ((await countUses(connection, usedCode)) >= usedCode.maxUses) {
        throw new CodeAlreadyUsed();
      }
    }

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO orders (received_at, status, customer_key, customer_name, phone, email, street,
        city, postal_code, note, payment_method, subtotal, delivery, total, discount_code,
        discount_percent, discount_amount, delivery_method, pickup, tax_percent, discount_name,
        discount_id, discount_shipping, lang)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        // Automatski popust nema kod; prepoznaje se po naslovu i id-u.
        order.discount?.code || null,
        order.discount?.percent ?? null,
        order.discount?.amount ?? 0,
        order.deliveryMethod,
        order.pickup,
        order.taxPercent,
        order.discount ? order.discount.label : null,
        usedCode?.discountId ?? null,
        order.discount?.freeShipping ?? false,
        order.lang ?? null,
      ],
    );
    const number = result.insertId;
    await addOrderEvent(connection, number, source);
    await connection.query(
      `INSERT INTO order_items (order_number, position, slug, name, variant, variant_id, sku, qty, price)
       VALUES ?`,
      [
        order.items.map((item, index) => [
          number,
          index,
          item.slug,
          item.name,
          item.variant,
          // Po id-u varijante se pri otkazivanju komadi vraćaju na njeno stanje.
          stock[index]?.variantId ?? "",
          item.sku,
          item.qty,
          item.price,
        ]),
      ],
    );

    // Skidanje sa stanja, samo tamo gde se vodi broj komada: kod varijante sa njenog stanja,
    // inače sa stanja proizvoda. Uslov u upitu čuva od toga da dve porudžbine u istom trenutku
    // prodaju isti poslednji komad.
    const sold: StockChange[] = [];
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
      sold.push({
        slug,
        variantId: variantId ?? "",
        change: -qty,
        qtyAfter: tracked[0].stock_qty - qty,
        reason: `Porudžbina #${number}`,
      });
    }
    await logStock(connection, sold);

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
export async function submitOrder(input: unknown, source = "Porudžbina primljena sa sajta"): Promise<OrderResult> {
  const { customer, items, discountCode, paymentMethod, deliveryMethod } = parseOrder(input);

  const errors = validateCustomer(customer);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const settings = await getSettings();
  const provider = cardProvider(settings);
  const payments = enabledPayments(settings, provider !== null);
  const payment = payments.find((method) => method === paymentMethod) as PaymentMethod | undefined;
  if (paymentMethod !== "" && !payment) {
    return { ok: false, errors: {}, message: "Izabrani način plaćanja nije dostupan." };
  }
  // Način dostave: izabrani, ili prvi koji važi za upisani poštanski broj.
  const methods = availableMethods(settings.shipping.methods, customer.postalCode);
  const method =
    deliveryMethod === ""
      ? (methods.find((candidate) => candidate.kind === "delivery") ?? methods[0])
      : methods.find((candidate) =>
          // "pickup" je oznaka iz prve verzije API-ja: prvo lično preuzimanje u spisku.
          deliveryMethod === "pickup" ? candidate.kind === "pickup" : candidate.id === deliveryMethod,
        );
  if (!method) {
    return { ok: false, errors: {}, message: "Izabrani način dostave nije dostupan za vašu adresu." };
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

  // Kod kupca ili automatski popust, onaj koji više štedi. Kod koji ne važi za ovu korpu se
  // javlja kupcu, da ne ostane u uverenju da je popust dobio.
  const quoted = await quoteLines(lines, applied, method, settings);
  if (quoted.codeError) return { ok: false, errors: {}, message: quoted.codeError };
  const { pricing } = quoted;
  const useCode = quoted.used;

  let order: Order;
  try {
    order = await insertOrder(
      {
        receivedAt: new Date().toISOString(),
        lang: await getShopLang(),
        status: "new",
        customerKey: customerKey(customer, settings.store.phonePrefix),
        customer,
        items: lines.map((line) => ({
          slug: line.product.slug,
          name: line.product.name,
          variant: line.variant ? variantLabel(line.variant) : "",
          // Šifra varijante, ako je upisana; inače šifra proizvoda.
          sku: line.variant?.sku || line.product.sku,
          qty: line.qty,
          // Cena u trenutku poručivanja: akcijska ako akcija važi.
          price: currentPrice(line.product, line.variant) ?? 0,
          returned: 0,
        })),
        paymentMethod: payment ?? payments[0],
        deliveryMethod: method.name,
        pickup: method.kind === "pickup",
        refunded: 0,
        taxPercent: settings.tax.enabled ? settings.tax.percent : null,
        subtotal: pricing.subtotal,
        delivery: pricing.delivery,
        total: pricing.total,
        ...(quoted.discount ? { discount: quoted.discount } : {}),
      },
      lines.map((line) => ({ slug: line.product.slug, variantId: line.variant?.id, qty: line.qty })),
      getWeight(lines),
      useCode,
      settings,
      source,
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
  emitOrderEvent("order.created", order.number);
  after(async () => {
    const error = await notifyOrder(order).catch((reason) => String(reason));
    if (error) {
      console.error(`[porudžbina ${order.number}] email nije poslat: ${error}`);
      await (
        await getDb()
      ).query("UPDATE orders SET email_error = ? WHERE number = ?", [error, order.number]);
    }
  });

  // Kartica: procesor daje adresu na kojoj kupac plaća. Ako pokretanje ne uspe, porudžbina
  // ostaje sačuvana kao neplaćena, a kupac dobija poruku umesto adrese.
  let paymentUrl: string | undefined;
  if (order.paymentMethod === "card" && provider) {
    const started = await provider.start({
      orderNumber: order.number,
      amount: order.total,
      currency: settings.store.currency,
      customerEmail: order.customer.email,
      callbackUrl: `${await siteUrl()}/api/v1/payments/${provider.id}`,
    });
    if (started.ok) paymentUrl = started.redirectUrl;
    else await addOrderEvent(await getDb(), order.number, `Plaćanje karticom nije pokrenuto: ${started.error}`);
  }

  return {
    ok: true,
    orderNumber: order.number,
    total: order.total,
    paymentMethod: order.paymentMethod,
    deliveryMethod: method.name,
    deliveryNote: method.confirmation,
    ...(paymentUrl ? { paymentUrl } : {}),
    ...(order.paymentMethod === "bank" && settings.payment.bankInstructions
      ? { paymentInstructions: settings.payment.bankInstructions }
      : {}),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vrednost proizvoda u porudžbini, posle popusta i bez dostave. */
function itemsValue(order: Order): number {
  // Novac vraćen kupcu nije prodaja.
  return Math.max(0, order.subtotal - (order.discount?.amount ?? 0) - order.refunded);
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
