// Rezervna kopija: cela baza (mysqldump) i folder sa ubačenim slikama.
//
//   npm run backup
//
// Pravi backups/shopcrm-<datum>.sql i backups/shopcrm-<datum>-slike.tar.gz.
// Podatke za bazu čita iz .env.local. Ako mysqldump nije u PATH-u, putanja se
// zadaje u MYSQLDUMP_PATH (MAMP: /Applications/MAMP/Library/bin/mysql80/bin/mysqldump).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, MYSQLDUMP_PATH, UPLOADS_DIR } = process.env;
if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error("Baza nije podešena: upišite DB_HOST, DB_USER, DB_PASSWORD i DB_NAME u .env.local.");
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
const directory = path.join(process.cwd(), "backups");
mkdirSync(directory, { recursive: true });

const sqlFile = path.join(directory, `shopcrm-${stamp}.sql`);
execFileSync(
  MYSQLDUMP_PATH ?? "mysqldump",
  [
    `--host=${DB_HOST}`,
    `--port=${DB_PORT ?? 3306}`,
    `--user=${DB_USER}`,
    "--single-transaction",
    "--no-tablespaces",
    "--default-character-set=utf8mb4",
    DB_NAME,
  ],
  // Lozinka ide kroz okruženje, da se ne vidi u spisku procesa.
  { env: { ...process.env, MYSQL_PWD: DB_PASSWORD ?? "" }, stdio: ["ignore", openSync(sqlFile, "w"), "inherit"] },
);
console.log(`Baza:  ${sqlFile}`);

const uploads = UPLOADS_DIR ?? path.join(process.cwd(), "storage", "uploads");
if (existsSync(uploads)) {
  const imagesFile = path.join(directory, `shopcrm-${stamp}-slike.tar.gz`);
  execFileSync("tar", ["-czf", imagesFile, "-C", path.dirname(uploads), path.basename(uploads)]);
  console.log(`Slike: ${imagesFile}`);
} else {
  console.log("Slike: nema ubačenih slika.");
}
