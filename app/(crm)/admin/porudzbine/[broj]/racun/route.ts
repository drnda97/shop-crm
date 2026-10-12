import { isAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { invoiceFileName, invoicePdf } from "@/lib/invoice";
import { getOrder } from "@/lib/order-store";

/** Račun porudžbine u PDF-u (lib/invoice.ts). Nije fiskalni račun. */
export async function GET(_request: Request, { params }: { params: Promise<{ broj: string }> }) {
  if (!(await isAdmin())) return new Response("Not found", { status: 404 });
  const [order, settings] = await Promise.all([getOrder((await params).broj), getSettings()]);
  if (!order) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(await invoicePdf(order, settings)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceFileName(order)}"`,
      "Cache-Control": "no-store",
    },
  });
}
