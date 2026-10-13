import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSecret } from "@/lib/admin-auth";

/**
 * Prijava kupaca preko Google naloga (OAuth 2.0, tok sa kodom). Podatke aplikacije upisuje svaka
 * prodavnica za sebe: Podešavanja → Prijava kupaca. Samo za server.
 */

export const GOOGLE_CALLBACK = "/api/auth/google/callback";
export const STATE_COOKIE = "shop-google-state";

/** Adresa na koju Google vraća kupca; ista se upisuje u Google Cloud konzoli. */
export function googleRedirectUri(base: string): string {
  return `${base}${GOOGLE_CALLBACK}`;
}

/** Vrednost `state`: nasumičan deo i potpis servera, da odgovor ne može da podmetne druga strana. */
export async function newState(): Promise<string> {
  const nonce = randomBytes(16).toString("base64url");
  return `${nonce}.${createHmac("sha256", await getSecret()).update(`google:${nonce}`).digest("base64url")}`;
}

export async function isValidState(state: string, cookie: string | undefined): Promise<boolean> {
  if (!state || !cookie || state.length !== cookie.length) return false;
  if (!timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) return false;
  const [nonce, signature] = state.split(".");
  const expected = createHmac("sha256", await getSecret()).update(`google:${nonce}`).digest("base64url");
  return signature !== undefined && signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function googleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

export type GoogleProfile = { email: string; firstName: string; lastName: string };

/** Šta piše u žetonu koji Google vrati; null kada žeton nije za ovu aplikaciju ili adresa nije potvrđena. */
export function readIdToken(idToken: string, clientId: string): GoogleProfile | null {
  try {
    const claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    const issuer = String(claims.iss ?? "");
    if (issuer !== "https://accounts.google.com" && issuer !== "accounts.google.com") return null;
    if (claims.aud !== clientId) return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    if (claims.email_verified !== true && claims.email_verified !== "true") return null;
    const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
    if (!email || email.length > 191) return null;
    const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 100) : "");
    return { email, firstName: text(claims.given_name) || text(claims.name) || email.split("@")[0], lastName: text(claims.family_name) };
  } catch {
    return null;
  }
}

/**
 * Menja kod iz odgovora za podatke kupca. Žeton stiže pravo od Google-a preko HTTPS-a, uz tajnu
 * aplikacije, pa mu se veruje bez provere potpisa.
 */
export async function exchangeCode(input: { code: string; clientId: string; clientSecret: string; redirectUri: string }): Promise<GoogleProfile | null> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { id_token?: unknown };
  return typeof body.id_token === "string" ? readIdToken(body.id_token, input.clientId) : null;
}
