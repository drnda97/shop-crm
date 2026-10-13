import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, googleRedirectUri, isValidState, STATE_COOKIE } from "@/lib/google-login";
import { googleLoginReady } from "@/lib/settings";
import { findOrCreateUser, startSession } from "@/lib/storefront/auth";
import { getShopSettings, siteUrl } from "@/lib/storefront/pages";

export const dynamic = "force-dynamic";

/** Povratak sa Google-a: proverava odgovor, nalazi ili pravi nalog kupca i prijavljuje ga. */
export async function GET(request: NextRequest) {
  const [settings, base] = await Promise.all([getShopSettings(), siteUrl()]);
  const failed = NextResponse.redirect(`${base}/nalog?greska=google`);
  failed.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
  if (!googleLoginReady(settings)) return failed;

  const query = request.nextUrl.searchParams;
  const code = query.get("code") ?? "";
  if (!code || !(await isValidState(query.get("state") ?? "", request.cookies.get(STATE_COOKIE)?.value))) return failed;

  let profile;
  try {
    profile = await exchangeCode({
      code,
      clientId: settings.auth.googleClientId,
      clientSecret: settings.auth.googleClientSecret,
      redirectUri: googleRedirectUri(base),
    });
  } catch (error) {
    console.error(`[google prijava] ${error instanceof Error ? error.message : error}`);
    return failed;
  }
  if (!profile) return failed;

  const user = await findOrCreateUser(profile);
  await startSession(user.id, true);
  const response = NextResponse.redirect(`${base}/nalog`);
  response.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
  return response;
}
