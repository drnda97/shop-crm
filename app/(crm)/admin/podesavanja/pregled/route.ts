import { hasAccess } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { getEmailTemplate, renderOrderEmail, sampleOrder } from "@/lib/order-email";

/** Pregled emaila sa probnom porudžbinom: ?za=prodavac ili (podrazumevano) za kupca. */
export async function GET(request: Request) {
  if (!(await hasAccess("settings"))) return new Response("Not found", { status: 404 });

  const settings = await getSettings();
  const { html } = renderOrderEmail({
    template: await getEmailTemplate(settings),
    order: sampleOrder(settings),
    recipient: new URL(request.url).searchParams.get("za") === "prodavac" ? "seller" : "customer",
    settings,
    logoSrc: settings.logo,
  });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Ubačeni šablon je tuđ HTML: prikazuje se bez skripti i bez pristupa panelu.
      "Content-Security-Policy":
        "sandbox; default-src 'none'; img-src 'self' data: https:; style-src 'unsafe-inline'",
    },
  });
}
