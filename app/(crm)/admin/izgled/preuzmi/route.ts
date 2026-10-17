import { hasAccess } from "@/lib/admin-auth";
import { exportTheme } from "@/lib/theme-packages";

/** Tema kao .zip (?tema={id}): za čuvanje, prenos na drugi sajt ili izmenu CSS-a. */
export async function GET(request: Request) {
  if (!(await hasAccess("content"))) return new Response("Not found", { status: 404 });
  const theme = await exportTheme(new URL(request.url).searchParams.get("tema") ?? "");
  if (!theme) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(theme.bytes), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${theme.name}"` },
  });
}
