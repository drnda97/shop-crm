import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Heš lozinke (scrypt sa solju) i provera; isti za naloge kupaca i korisnike panela. Samo za server. */

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function passwordMatches(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Heš koji se proverava kada naloga nema, da vreme odgovora ne otkrije koja imena postoje. */
export const DUMMY_HASH = hashPassword("", "00");
