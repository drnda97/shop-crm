import { NextResponse } from "next/server";
import { hasAccess } from "@/lib/admin-auth";
import { setStoredValue } from "@/lib/content";
import { PREVIEW_KEY, type PreviewDraft } from "@/lib/storefront/pages";
import { themePreview } from "@/lib/theme-packages";
import { HOME_PREVIEW, previewUrl } from "../parts";

/** Pregled teme iz biblioteke na sajtu, pre objave: ?tema={id}. Kupci i dalje vide aktivnu temu. */
export async function GET(request: Request) {
  if (!(await hasAccess("content"))) return new Response("Not found", { status: 404 });
  const design = await themePreview(new URL(request.url).searchParams.get("tema") ?? "");
  if (!design) return new Response("Not found", { status: 404 });
  const draft: PreviewDraft = { kind: "settings", settings: design };
  await setStoredValue(PREVIEW_KEY, JSON.stringify(draft));
  return NextResponse.redirect(new URL(await previewUrl(HOME_PREVIEW), request.url));
}
