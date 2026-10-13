import { NextResponse } from "next/server";
import { googleAuthUrl, googleRedirectUri, newState, STATE_COOKIE } from "@/lib/google-login";
import { googleLoginReady } from "@/lib/settings";
import { getShopSettings, siteUrl } from "@/lib/storefront/pages";

export const dynamic = "force-dynamic";

/** Početak prijave preko Google naloga: šalje kupca Google-u. */
export async function GET() {
  const [settings, base] = await Promise.all([getShopSettings(), siteUrl()]);
  if (!googleLoginReady(settings)) return NextResponse.redirect(`${base}/nalog`);
  const state = await newState();
  const response = NextResponse.redirect(googleAuthUrl(settings.auth.googleClientId, googleRedirectUri(base), state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: base.startsWith("https://"),
    path: "/api/auth/google",
    maxAge: 600,
  });
  return response;
}
