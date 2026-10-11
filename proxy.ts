import { NextResponse, type NextRequest } from "next/server";
import { PREVIEW_HEADER, PREVIEW_PARAM } from "@/lib/storefront/preview-names";

/**
 * Pregled nesačuvanih izmena iz panela: žeton iz adrese (?pregled=…) prelazi u zaglavlje
 * zahteva, da ga pročitaju i delovi sajta koji adresu ne vide (layout, podnožje).
 * Zaglavlje koje bi poslao sam posetilac se odbacuje; žeton se proverava tamo gde se čita.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const token = request.nextUrl.searchParams.get(PREVIEW_PARAM);
  if (token) headers.set(PREVIEW_HEADER, token);
  else headers.delete(PREVIEW_HEADER);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Samo stranice prodavnice: panel, API i fajlovi ne učestvuju u pregledu.
  matcher: ["/((?!admin|api/|media/|shop/|_next/|favicon.ico|sdk.js|demo.html).*)"],
};
