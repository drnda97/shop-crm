import { getSettings } from "@/lib/content";
import { invoiceFileName, invoicePdf } from "@/lib/invoice";
import { getCurrentUser, getUserOrders } from "@/lib/storefront/auth";

/** Račun u PDF-u za prijavljenog kupca: samo za porudžbine napravljene pod njegovim nalogom. */
export async function GET(_request: Request, { params }: { params: Promise<{ broj: string }> }) {
  const user = await getCurrentUser();
  const { broj } = await params;
  const order = user ? (await getUserOrders(user.id)).find((candidate) => candidate.number === broj) : undefined;
  // Tuđa i nepostojeća porudžbina daju isti odgovor.
  if (!order) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(await invoicePdf(order, await getSettings())), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceFileName(order)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
