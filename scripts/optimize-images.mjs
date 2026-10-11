// Slike ubačene pre uvođenja obrade slika (JPG, PNG ili WebP u jednoj veličini) pretvara u
// WebP u više širina i upisuje nove putanje u proizvode i stranice.
//
//   npm run images:optimize                    stari fajlovi ostaju na disku
//   npm run images:optimize -- --delete-old    stari fajlovi se brišu
//
// Logo i favicon se ne diraju (logo ide i u email, gde WebP ne radi svuda). Bezbedno je
// pokrenuti je više puta: slike koje su već obrađene se preskaču. Pre prvog pokretanja
// napravite rezervnu kopiju (npm run backup).
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { makeSizes } from "../lib/images.ts";

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, UPLOADS_DIR } = process.env;
if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error("Baza nije podešena: upišite DB_HOST, DB_USER, DB_PASSWORD i DB_NAME u .env.local.");
  process.exit(1);
}
const deleteOld = process.argv.includes("--delete-old");
const uploadsDir = UPLOADS_DIR ?? path.join(process.cwd(), "storage", "uploads");

const db = await mysql.createConnection({
  host: DB_HOST,
  port: DB_PORT ? Number(DB_PORT) : 3306,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  charset: "utf8mb4",
});

const [settingsRows] = await db.query("SELECT value FROM settings WHERE name = 'settings'");
const settings = settingsRows.length > 0 ? JSON.parse(settingsRows[0].value) : {};
const keep = new Set([settings.logo, settings.favicon].filter(Boolean));

// Stara slika: fotografija koja nije ni najveća veličina („-full") ni neka od manjih („-w640").
const old = (existsSync(uploadsDir) ? readdirSync(uploadsDir) : []).filter(
  (name) =>
    /^[a-z0-9-]+\.(jpg|png|webp)$/.test(name) &&
    !/-(full|w\d+)\.webp$/.test(name) &&
    !keep.has(`/media/${name}`),
);

let converted = 0;
let failed = 0;
await db.beginTransaction();
try {
  for (const name of old) {
    const from = `/media/${name}`;
    const base = name.replace(/\.[a-z]+$/, "");
    const to = `/media/${base}-full.webp`;
    try {
      if (!existsSync(path.join(uploadsDir, `${base}-full.webp`))) {
        for (const item of await makeSizes(readFileSync(path.join(uploadsDir, name)), base)) {
          writeFileSync(path.join(uploadsDir, item.name), item.data);
        }
      }
    } catch (error) {
      console.error(`Preskočeno ${name}: ${error.message}`);
      failed++;
      continue;
    }
    await db.query("UPDATE products SET image = ? WHERE image = ?", [to, from]);
    await db.query("UPDATE product_images SET src = ? WHERE src = ?", [to, from]);
    // U sekcijama stranica putanja je unutar JSON zapisa, uvek pod navodnicima.
    await db.query("UPDATE pages SET sections = REPLACE(sections, ?, ?) WHERE sections LIKE ?", [
      JSON.stringify(from),
      JSON.stringify(to),
      `%${name}%`,
    ]);
    converted++;
  }
  await db.commit();
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}

if (deleteOld) {
  for (const name of old) {
    const base = name.replace(/\.[a-z]+$/, "");
    if (existsSync(path.join(uploadsDir, `${base}-full.webp`))) unlinkSync(path.join(uploadsDir, name));
  }
}

console.log(`Obrađeno slika: ${converted}. Neuspelo: ${failed}.`);
if (converted > 0 && !deleteOld) {
  console.log("Stari fajlovi su ostali na disku; u panelu (Slike) se vide kao nekorišćeni i mogu da se obrišu.");
}
