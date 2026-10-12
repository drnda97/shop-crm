import { hasAccess } from "@/lib/admin-auth";
import { exportCustomer } from "@/lib/privacy";

/** Svi podaci koje prodavnica čuva o kupcu, kao JSON fajl — za predaju kupcu na njegov zahtev. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!(await hasAccess("orders"))) return new Response("Not found", { status: 404 });
  const { key } = await params;
  const data = await exportCustomer(key);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="podaci-kupca.json"`,
      "Cache-Control": "no-store",
    },
  });
}
