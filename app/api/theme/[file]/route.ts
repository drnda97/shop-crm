import { themeCss } from "@/lib/storefront/theme-css";
import { THEME_LIST } from "@/themes/list";

/** Stilovi teme: /api/theme/{id}.css. Link ka njima ispisuje layout prodavnice, samo za izabranu temu. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const theme = THEME_LIST.find((candidate) => `${candidate.id}.css` === file);
  if (!theme) return new Response("Not found", { status: 404 });
  const { css } = await themeCss(theme.id);
  return new Response(css, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      // Adresa sadrži otisak sadržaja (?v=…), pa se odgovor pamti trajno.
      "Cache-Control": process.env.NODE_ENV === "production" ? "public, max-age=31536000, immutable" : "no-store",
    },
  });
}
