import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Preuzimanje slike sa tuđe adrese, pri uvozu proizvoda. Adresu upisuje onaj ko je napravio
 * CSV, pa se preuzima samo sa javnih adresa: zahtev ka unutrašnjoj mreži servera se odbija.
 * Samo za server.
 */

const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/** Adrese koje nisu na javnom internetu: lokalni računar, privatne mreže, adrese za otkrivanje uređaja. */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const lower = address.toLowerCase();
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

async function isPublicUrl(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  try {
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
  } catch {
    return false;
  }
}

/** Sadržaj slike sa date adrese, ili null kada adresa nije javna, ne odgovara ili je fajl prevelik. */
export async function fetchImage(address: string): Promise<Buffer | null> {
  try {
    let url = new URL(address);
    // Preusmerenja se prate ručno, da se i odredište proveri pre zahteva.
    for (let hop = 0; hop < 4; hop++) {
      if (!(await isPublicUrl(url))) return null;
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        url = new URL(location, url);
        continue;
      }
      if (!response.ok || Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      return bytes.length > 0 && bytes.length <= MAX_BYTES ? bytes : null;
    }
    return null;
  } catch {
    return null;
  }
}
