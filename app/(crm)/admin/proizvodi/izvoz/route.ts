import { hasAccess } from "@/lib/admin-auth";
import { baseUrl } from "@/lib/api";
import { getCategories, getCollections, getProducts, getSettings } from "@/lib/content";
import { csvResponse } from "@/lib/csv";
import { helpSheet } from "@/lib/import-example";
import { EXPORT_HEADER, exportRows } from "@/lib/product-import";
import { xlsxResponse } from "@/lib/xlsx";

/**
 * Svi proizvodi: red po proizvodu, pa red po varijanti. ?format=xlsx daje Excel (sa listom
 * „Uputstvo"), inače CSV. Isti fajl se, izmenjen, uvozi nazad (Proizvodi → Uvoz).
 */
export async function GET(request: Request) {
  if (!(await hasAccess("catalog"))) return new Response("Not found", { status: 404 });
  const [products, categories, collections, settings] = await Promise.all([getProducts(), getCategories(), getCollections(), getSettings()]);
  const rows = exportRows(products, categories, settings.store.currencyDecimals, baseUrl(request, settings), collections);
  if (new URL(request.url).searchParams.get("format") === "xlsx") {
    return xlsxResponse("proizvodi.xlsx", [
      { name: "Proizvodi", header: true, rows, widths: EXPORT_HEADER.map((column) => (["opis", "detalji", "opcije", "slike"].includes(column) ? 48 : 16)) },
      helpSheet(),
    ]);
  }
  return csvResponse("proizvodi.csv", rows);
}
