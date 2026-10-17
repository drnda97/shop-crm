import { hasAccess } from "@/lib/admin-auth";
import { baseUrl } from "@/lib/api";
import { getSettings } from "@/lib/content";
import { csvResponse } from "@/lib/csv";
import { exampleRows, exampleSheets } from "@/lib/import-example";
import { xlsxResponse } from "@/lib/xlsx";

/** Primer fajla za uvoz proizvoda: ?format=csv daje CSV, inače Excel sa listom „Uputstvo". */
export async function GET(request: Request) {
  if (!(await hasAccess("catalog"))) return new Response("Not found", { status: 404 });
  const base = baseUrl(request, await getSettings());
  if (new URL(request.url).searchParams.get("format") === "csv") return csvResponse("primer-uvoz-proizvoda.csv", exampleRows(base));
  return xlsxResponse("primer-uvoz-proizvoda.xlsx", exampleSheets(base));
}
