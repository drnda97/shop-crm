/**
 * Ograničenje broja pokušaja po adresi, protiv nagađanja lozinke i zatrpavanja formi.
 * Pamti se u memoriji procesa, pa na hostingu sa više procesa važi po procesu i briše se
 * pri ponovnom pokretanju — gruba, ali besplatna zaštita.
 */

const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, number[]>();

export const TOO_MANY = "Previše pokušaja. Sačekajte nekoliko minuta.";

/** Adresa posetioca; iza proxy-ja hostinga je prva u zaglavlju x-forwarded-for. */
export function clientIp(headers: Headers): string {
  return (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

/**
 * Beleži pokušaj i vraća true kada ih je u poslednjih deset minuta bilo više od `max`.
 * `kind` razdvaja brojače (prijava, porudžbina…), da jedna forma ne troši pokušaje druge.
 */
export function tooMany(kind: string, ip: string, max: number, now = Date.now()): boolean {
  const key = `${kind}:${ip}`;
  const times = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (times.length >= max) {
    attempts.set(key, times);
    return true;
  }
  times.push(now);
  attempts.set(key, times);
  // Da mapa ne raste bez kraja: povremeno se izbace adrese bez skorašnjih pokušaja.
  if (attempts.size > 5000) {
    for (const [name, value] of attempts) {
      if (value.every((time) => now - time >= WINDOW_MS)) attempts.delete(name);
    }
  }
  return false;
}
