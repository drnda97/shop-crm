import { isAdmin } from "@/lib/admin-auth";
import { baseUrl } from "@/lib/api";
import { getCategories, getProducts, getSettings } from "@/lib/content";
import { csvResponse } from "@/lib/csv";
import { exportRows } from "@/lib/product-import";

/**
 * Svi proizvodi kao CSV: red po proizvodu, pa red po varijanti. Isti fajl se, izmenjen u
 * Excel-u, uvozi nazad (Proizvodi → Uvoz).
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Not found", { status: 404 });
  const [products, categories, settings] = await Promise.all([getProducts(), getCategories(), getSettings()]);
  return csvResponse(
    "proizvodi.csv",
    exportRows(products, categories, settings.store.currencyDecimals, baseUrl(request)),
  );
}
