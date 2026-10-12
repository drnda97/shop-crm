import { after } from "next/server";
import { baseUrl, publicProduct } from "@/lib/api";
import { getProducts, updateContent } from "@/lib/content";
import { getDb } from "@/lib/db";
import { apiOrder, checkApiKey, type ApiKey } from "@/lib/integrations";
import { notifyStatus } from "@/lib/order-email";
import { addOrderEvent, getOrder, getOrders, setOrderStatus, setOrderTracking } from "@/lib/order-store";
import { orderStatusLabels, type OrderStatus } from "@/lib/orders";
import { clientIp, tooMany } from "@/lib/rate-limit";

/**
 * API za spoljne sisteme (knjigovodstvo, magacin, kurirska služba). Traži ključ iz panela
 * (Integracije) u zaglavlju `Authorization: Bearer sk_…`. Zove se sa servera, ne iz
 * pregledača: ključ ne sme u kod sajta, pa ovde nema CORS zaglavlja.
 *
 *   GET  /api/v1/admin/orders                   ?status=  ?since=ISO datum  ?limit= (do 500)
 *   GET  /api/v1/admin/orders/{broj}
 *   POST /api/v1/admin/orders/{broj}/status     { status, notify? }   — ključ sa izmenama
 *   POST /api/v1/admin/orders/{broj}/tracking   { number, url? }      — ključ sa izmenama
 *   GET  /api/v1/admin/products                 svi proizvodi, i nacrti, sa stanjem
 *   POST /api/v1/admin/products/{slug}/stock    { qty, variant? }     — ključ sa izmenama
 */

type Context = { params: Promise<{ path: string[] }> };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const notFound = () => json({ error: "Not found" }, 404);

async function authorize(request: Request, write: boolean): Promise<ApiKey | Response> {
  // Protiv nagađanja ključa: broje se samo zahtevi bez ispravnog ključa.
  const key = await checkApiKey(request);
  if (!key) {
    if (tooMany("api-key", clientIp(request.headers), 20)) return json({ error: "Too many attempts" }, 429);
    return json({ error: "Missing or invalid API key" }, 401);
  }
  if (write && key.scope !== "write") return json({ error: "This key is read-only" }, 403);
  return key;
}

export async function GET(request: Request, { params }: Context) {
  const key = await authorize(request, false);
  if (key instanceof Response) return key;
  const [resource, id, extra] = (await params).path;
  if (extra !== undefined) return notFound();

  if (resource === "orders") {
    if (id) {
      const order = await getOrder(id);
      return order ? json({ order: apiOrder(order) }) : notFound();
    }
    const query = new URL(request.url).searchParams;
    const status = query.get("status");
    const since = Date.parse(query.get("since") ?? "");
    const limit = Math.min(Math.max(Number(query.get("limit")) || 100, 1), 500);
    const orders = (await getOrders())
      .filter((order) => (!status || order.status === status) && (Number.isNaN(since) || Date.parse(order.receivedAt) >= since))
      // Najnovije prve.
      .reverse()
      .slice(0, limit);
    return json({ orders: orders.map(apiOrder) });
  }

  if (resource === "products" && !id) {
    const base = baseUrl(request);
    return json({
      products: (await getProducts()).map((product) => ({
        ...publicProduct(product, base),
        active: product.active,
        /** Broj komada; null kada se stanje ne vodi brojem. */
        stockQty: product.stockQty,
        variantStock: product.variants.map((variant) => ({ id: variant.id, sku: variant.sku, stockQty: variant.stockQty })),
      })),
    });
  }
  return notFound();
}

export async function POST(request: Request, { params }: Context) {
  const key = await authorize(request, true);
  if (key instanceof Response) return key;
  const [resource, id, action, extra] = (await params).path;
  if (!id || !action || extra !== undefined) return notFound();
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const by = `API ključ „${key.name}"`;

  if (resource === "orders") {
    const order = await getOrder(id);
    if (!order) return notFound();

    if (action === "status") {
      const status = String(body.status ?? "");
      if (!(status in orderStatusLabels)) {
        return json({ error: `status must be one of: ${Object.keys(orderStatusLabels).join(", ")}` }, 400);
      }
      if (await setOrderStatus(id, status as OrderStatus)) {
        await addOrderEvent(await getDb(), id, `Status je promenio ${by}`);
        // Email kupcu, isto kao iz panela; `notify: false` ga preskače.
        if (body.notify !== false) {
          after(async () => {
            const current = await getOrder(id);
            if (!current || current.status !== status) return;
            const outcome = await notifyStatus(current).catch((reason) => String(reason));
            if (outcome === "skipped") return;
            await addOrderEvent(
              await getDb(),
              id,
              outcome === "sent" ? `Kupcu je poslat email: ${orderStatusLabels[current.status].toLowerCase()}` : `Email kupcu nije poslat: ${outcome}`,
            );
          });
        }
      }
      return json({ order: apiOrder((await getOrder(id))!) });
    }

    if (action === "tracking") {
      const number = String(body.number ?? "").trim().slice(0, 100);
      const url = String(body.url ?? "").trim().slice(0, 500);
      if (url !== "" && !/^https?:\/\//.test(url)) return json({ error: "url must start with http:// or https://" }, 400);
      await setOrderTracking(id, { number, url });
      return json({ order: apiOrder((await getOrder(id))!) });
    }
    return notFound();
  }

  if (resource === "products" && action === "stock") {
    const qty = body.qty === null ? null : Number(body.qty);
    if (qty !== null && (!Number.isInteger(qty) || qty < 0 || qty > 1_000_000)) {
      return json({ error: "qty must be a whole number from 0 to 1000000, or null to stop tracking" }, 400);
    }
    const variantId = body.variant === undefined ? "" : String(body.variant);
    let found = false;
    await updateContent((content) => {
      const product = content.products.find((candidate) => candidate.slug === id);
      const target = variantId ? product?.variants.find((variant) => variant.id === variantId) : product;
      if (!target) return;
      target.stockQty = qty;
      found = true;
    }, `Stanje je upisao ${by}`);
    return found ? json({ slug: id, variant: variantId || null, stockQty: qty }) : notFound();
  }
  return notFound();
}
