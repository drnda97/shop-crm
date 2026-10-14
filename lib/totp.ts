import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Prijava u dva koraka: jednokratni kodovi iz aplikacije (Google Authenticator, Aegis, 1Password…),
 * po standardu TOTP (RFC 6238): šest cifara, nov kod na svakih 30 sekundi. Samo za server.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

export function base32Encode(bytes: Buffer): string {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let text = "";
  for (let index = 0; index < bits.length; index += 5) {
    text += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return text;
}

export function base32Decode(text: string): Buffer {
  let bits = "";
  for (const char of text.toUpperCase().replace(/[^A-Z2-7]/g, "")) bits += ALPHABET.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

/** Nova tajna za aplikaciju, 160 bita. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Kod koji važi u datom trenutku. */
export function totpCode(secret: string, time = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / STEP_SECONDS)));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

/**
 * Period (broj 30-sekundnih koraka) kome kod pripada, ili null kada kod nije ispravan. Prolazi kod
 * iz trenutnog perioda i susednih, da sat telefona sme da kasni ili žuri do pola minuta.
 * Period se pamti uz korisnika, da isti kod ne prođe dva puta.
 */
export function totpStep(secret: string, input: string, time = Date.now()): number | null {
  const code = input.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(time / 1000 / STEP_SECONDS);
  for (const shift of [-1, 0, 1]) {
    const expected = Buffer.from(totpCode(secret, time + shift * STEP_SECONDS * 1000));
    if (timingSafeEqual(expected, Buffer.from(code))) return now + shift;
  }
  return null;
}

export function verifyTotp(secret: string, input: string, time = Date.now()): boolean {
  return totpStep(secret, input, time) !== null;
}

/** Adresa koju aplikacija čita iz QR koda. */
export function otpauthUrl(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

/** Rezervni kodovi: za prijavu kada telefon nije pri ruci. Svaki važi jednom. */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const text = randomBytes(5).toString("hex").toUpperCase();
    return `${text.slice(0, 5)}-${text.slice(5)}`;
  });
}
