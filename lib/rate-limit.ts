/**
 * Ograničenje broja pokušaja po adresi, protiv nagađanja lozinke i zatrpavanja formi.
 * Pamti se u memoriji procesa, pa na hostingu sa više procesa važi po procesu i briše se
 * pri ponovnom pokretanju — gruba, ali besplatna zaštita.
 */

const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, number[]>();

export const TOO_MANY = "Previše pokušaja. Sačekajte nekoliko minuta.";

/**
 * Adresa posetioca. Proxy hostinga dopisuje adresu sa koje je dobio zahtev na kraj zaglavlja
 * x-forwarded-for, a sve ispred nje šalje sam posetilac. Zato se uzima adresa koju je dopisao
 * proxy najbliži posetiocu: TRUSTED_PROXIES kaže koliko ih stoji ispred aplikacije (podrazumevano 1).
 * Bez proxy-ja ispred aplikacije zaglavlje ostaje posetiočevo, pa prijava i lozinke imaju i
 * brojač po nalogu, a porudžbine ukupnu granicu (tooManyOrders).
 */
export function clientIp(headers: Headers): string {
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
  const hops = Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXIES)) || 1);
  return chain[Math.max(0, chain.length - hops)] ?? "unknown";
}

/** Porudžbina sa svih adresa zajedno za deset minuta; iznad toga je zatrpavanje, ne kupovina. */
const ORDERS_PER_WINDOW = 100;

/** Ukupna granica porudžbina, nezavisna od adrese posetioca. */
export function tooManyOrders(now = Date.now()): boolean {
  return tooMany("order-all", "*", ORDERS_PER_WINDOW, now);
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
