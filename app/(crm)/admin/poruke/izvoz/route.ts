import { hasAccess } from "@/lib/admin-auth";
import { csvResponse } from "@/lib/csv";
import { getSubscribers } from "@/lib/storefront/inbox";

/** Prijavljeni na novosti kao CSV; odjavljeni su označeni, da ih ne uvezete u drugi servis. */
export async function GET() {
  if (!(await hasAccess("orders"))) return new Response("Not found", { status: 404 });
  const subscribers = await getSubscribers();
  return csvResponse("novosti.csv", [
    ["Email", "Prijavljen", "Odjavljen"],
    ...subscribers.map((item) => [item.email, item.createdAt.slice(0, 10), item.unsubscribed ? "da" : "ne"]),
  ]);
}
