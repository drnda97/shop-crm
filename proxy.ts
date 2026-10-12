import { NextResponse, type NextRequest } from "next/server";
import { canonicalPath, splitLang } from "@/lib/routes";
import { LANG_HEADER } from "@/lib/storefront/preview-names";
import { PREVIEW_HEADER, PREVIEW_PARAM } from "@/lib/storefront/preview-names";

/**
 * Tri stvari za stranice prodavnice:
 * - Pregled nesačuvanih izmena iz panela: žeton iz adrese (?pregled=…) prelazi u zaglavlje
 *   zahteva, da ga pročitaju i delovi sajta koji adresu ne vide (layout, podnožje).
 *   Zaglavlje koje bi poslao sam posetilac se odbacuje; žeton se proverava tamo gde se čita.
 * - Jezik: početak adrese (/en, /de) prelazi u zaglavlje, a stranica se traži bez njega.
 *   Da li prodavnica taj jezik ima proverava layout prodavnice.
 * - Adrese na jeziku sajta (/collection, /checkout…) se iznutra vode na rute sa srpskim
 *   adresama (lib/routes.ts); posetilac u adresi i dalje vidi prevedenu.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const token = request.nextUrl.searchParams.get(PREVIEW_PARAM);
  if (token) headers.set(PREVIEW_HEADER, token);
  else headers.delete(PREVIEW_HEADER);

  const withLang = splitLang(request.nextUrl.pathname);
  if (withLang) headers.set(LANG_HEADER, withLang.lang);
  else headers.delete(LANG_HEADER);
  const pathname = withLang?.pathname ?? request.nextUrl.pathname;

  const canonical = canonicalPath(pathname, request.nextUrl.search);
  if (canonical || withLang) {
    const url = request.nextUrl.clone();
    url.pathname = canonical?.pathname ?? pathname;
    if (canonical) url.search = canonical.search;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Samo stranice prodavnice: panel, API i fajlovi ne učestvuju.
  matcher: ["/((?!admin|api/|media/|shop/|_next/|favicon.ico|sdk.js|demo.html).*)"],
};
