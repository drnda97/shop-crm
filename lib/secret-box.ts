import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Settings } from "@/lib/settings";

/**
 * Šifrovanje tajni koje se čuvaju u bazi, a moraju da se pročitaju (SMTP lozinka, Google tajna):
 * ko dođe do kopije baze, bez ključa ih ne vidi. Ključ zato nije u bazi: DATA_KEY iz okruženja,
 * ili fajl storage/data.key (DATA_KEY_FILE ga premešta) koji se napravi sam pri prvoj upotrebi.
 * Bez ključa se sačuvane tajne ne mogu pročitati i upisuju se ponovo u Podešavanjima.
 */

const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function keyFile(): string {
  // turbopackIgnore: putanja je poznata tek pri radu, pa build ne treba da prati ceo projekat.
  return process.env.DATA_KEY_FILE || path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "data.key");
}

function dataKey(): Buffer {
  if (cachedKey) return cachedKey;
  let material = process.env.DATA_KEY ?? "";
  if (!material) {
    const file = keyFile();
    if (!existsSync(file)) {
      mkdirSync(path.dirname(file), { recursive: true });
      // wx: ako je drugi proces upravo napravio fajl, upis ne uspeva i čita se njegov ključ.
      try {
        writeFileSync(file, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 });
        chmodSync(file, 0o600);
      } catch (error) {
        if ((error as { code?: string }).code !== "EEXIST") throw error;
      }
    }
    material = readFileSync(file, "utf8").trim();
  }
  cachedKey = createHash("sha256").update(material).digest();
  return cachedKey;
}

/** Šifrovana vrednost za upis u bazu; prazna ostaje prazna. */
export function seal(value: string): string {
  if (value === "" || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

/**
 * Vrednost iz baze. Upisana pre šifrovanja (bez oznake) vraća se kakva jeste i šifruje pri
 * sledećem čuvanju. Koja ne može da se dešifruje (drugi ključ) je prazna: tajna se upisuje ponovo.
 */
export function unseal(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  try {
    const data = Buffer.from(value.slice(PREFIX.length), "base64");
    const decipher = createDecipheriv("aes-256-gcm", dataKey(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    console.error("[tajne] SMTP lozinka ili Google tajna ne mogu da se pročitaju: ključ (DATA_KEY ili storage/data.key) nije onaj kojim su sačuvane. Upišite ih ponovo u Podešavanjima.");
    return "";
  }
}

/** Podešavanja za upis u bazu: tajne šifrovane. */
export function sealSettings(settings: Settings): Settings {
  return {
    ...settings,
    mail: { ...settings.mail, smtpPassword: seal(settings.mail.smtpPassword) },
    auth: { ...settings.auth, googleClientSecret: seal(settings.auth.googleClientSecret) },
  };
}

/** Podešavanja pročitana iz baze, pre spajanja sa podrazumevanim: tajne dešifrovane. */
export function unsealSettings(saved: Partial<Settings>): Partial<Settings> {
  const out = { ...saved };
  if (typeof saved.mail?.smtpPassword === "string") out.mail = { ...saved.mail, smtpPassword: unseal(saved.mail.smtpPassword) };
  if (typeof saved.auth?.googleClientSecret === "string") out.auth = { ...saved.auth, googleClientSecret: unseal(saved.auth.googleClientSecret) };
  return out;
}

/** Samo za testove: zaboravlja učitan ključ. */
export function resetKeyForTests() {
  cachedKey = null;
}
