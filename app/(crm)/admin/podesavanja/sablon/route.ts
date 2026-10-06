import { isAdmin } from "@/lib/admin-auth";
import { defaultEmailTemplate } from "@/lib/email-template";

/** Preuzimanje našeg šablona emaila, kao polazne tačke za sopstveni. */
export async function GET() {
  if (!(await isAdmin())) return new Response("Not found", { status: 404 });

  return new Response(defaultEmailTemplate, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": 'attachment; filename="email-sablon.html"',
    },
  });
}
