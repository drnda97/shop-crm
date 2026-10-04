import mysql, { type Pool } from "mysql2/promise";

/**
 * Veza sa MySQL bazom. Podaci za pristup su u okruženju (.env.local):
 * DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, i po potrebi DB_SSL ili DB_SSL_CA.
 *
 * Tabele se prave same pri prvom povezivanju — na hostingu je dovoljno
 * napraviti praznu bazu i upisati podatke za pristup. Samo za server.
 */

// TEXT umesto JSON kolona: radi isto na MySQL-u i na MariaDB-u, koji je čest na hostingu.
const TABLES = [
  `CREATE TABLE IF NOT EXISTS products (
    slug VARCHAR(191) NOT NULL PRIMARY KEY,
    position INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(64) NOT NULL DEFAULT '',
    category VARCHAR(191) NOT NULL DEFAULT '',
    active TINYINT(1) NOT NULL DEFAULT 1,
    summary VARCHAR(500) NOT NULL,
    description MEDIUMTEXT NOT NULL,
    attributes TEXT NOT NULL,
    price INT NULL,
    sale_price INT NULL,
    weight INT NULL,
    in_stock TINYINT(1) NOT NULL DEFAULT 1,
    stock_qty INT NULL,
    low_stock_mode VARCHAR(10) NOT NULL DEFAULT 'off',
    low_stock_threshold INT NULL,
    image VARCHAR(255) NULL
  )`,
  `CREATE TABLE IF NOT EXISTS product_images (
    product_slug VARCHAR(191) NOT NULL,
    position INT NOT NULL,
    src VARCHAR(255) NOT NULL,
    PRIMARY KEY (product_slug, position)
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    position INT NOT NULL,
    label VARCHAR(255) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS collections (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    position INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS collection_products (
    collection_id VARCHAR(191) NOT NULL,
    product_slug VARCHAR(191) NOT NULL,
    position INT NOT NULL,
    PRIMARY KEY (collection_id, product_slug)
  )`,
  `CREATE TABLE IF NOT EXISTS pages (
    slug VARCHAR(191) NOT NULL PRIMARY KEY,
    position INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    body MEDIUMTEXT NOT NULL,
    show_in_footer TINYINT(1) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS page_images (
    page_slug VARCHAR(191) NOT NULL,
    id VARCHAR(64) NOT NULL,
    position INT NOT NULL,
    src VARCHAR(255) NOT NULL,
    alt VARCHAR(255) NOT NULL,
    PRIMARY KEY (page_slug, id)
  )`,
  // Podešavanja ("settings", JSON) i sopstveni šablon emaila ("email_template").
  `CREATE TABLE IF NOT EXISTS settings (
    name VARCHAR(191) NOT NULL PRIMARY KEY,
    value MEDIUMTEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS discounts (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    position INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32) NOT NULL DEFAULT '',
    percent INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    trigger_type VARCHAR(20) NOT NULL,
    threshold INT NOT NULL,
    max_uses INT NULL,
    expires_at VARCHAR(10) NULL
  )`,
  // Kodovi poslati kupcima kao nagrada: jedan red po slanju. Procenat i naslov su prepis
  // iz pravila, pa poslat kod važi i kada se pravilo promeni ili obriše.
  `CREATE TABLE IF NOT EXISTS discount_codes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(32) NOT NULL,
    discount_id VARCHAR(191) NOT NULL,
    discount_name VARCHAR(255) NOT NULL,
    percent INT NOT NULL,
    issued_order INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(64) NOT NULL DEFAULT '',
    created_at DATETIME(3) NOT NULL,
    used_order INT NULL,
    used_at DATETIME(3) NULL,
    KEY discount_codes_code (code),
    KEY discount_codes_discount (discount_id)
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    number INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    received_at DATETIME(3) NOT NULL,
    status VARCHAR(20) NOT NULL,
    customer_key VARCHAR(191) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    email VARCHAR(255) NOT NULL,
    street VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    postal_code VARCHAR(16) NOT NULL,
    note TEXT NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cod',
    subtotal INT NOT NULL,
    delivery INT NOT NULL,
    total INT NOT NULL,
    discount_code VARCHAR(32) NULL,
    discount_percent INT NULL,
    discount_amount INT NOT NULL DEFAULT 0,
    issued_code VARCHAR(32) NULL,
    issued_percent INT NULL,
    issued_title VARCHAR(255) NULL,
    email_error TEXT NULL,
    admin_note TEXT NULL,
    KEY orders_received_at (received_at),
    KEY orders_customer (customer_key),
    KEY orders_discount_code (discount_code)
  ) AUTO_INCREMENT = 1001`,
  // Naziv i cena su prepis iz trenutka poručivanja, pa nema veze ka tabeli products.
  `CREATE TABLE IF NOT EXISTS order_items (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_number INT NOT NULL,
    position INT NOT NULL,
    slug VARCHAR(191) NOT NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(64) NOT NULL DEFAULT '',
    qty INT NOT NULL,
    price INT NOT NULL,
    KEY order_items_order (order_number)
  )`,
  // Beleške prodavca o kupcu (deo Kupci).
  `CREATE TABLE IF NOT EXISTS customer_notes (
    customer_key VARCHAR(191) NOT NULL PRIMARY KEY,
    note TEXT NOT NULL,
    updated_at DATETIME(3) NOT NULL
  )`,
];

/** Kolone dodate posle prve verzije tabele: [tabela, kolona, definicija]. Baza koja već postoji dobija ih pri pokretanju. */
const ADDED_COLUMNS: [string, string, string][] = [];

async function createSchema(pool: Pool) {
  for (const table of TABLES) {
    await pool.query(`${table} ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  for (const [table, column, definition] of ADDED_COLUMNS) {
    const [existing] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column],
    );
    if (existing.length === 0) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

/**
 * Sertifikat iz promenljive okruženja često stigne bez preloma redova (paneli hostinga ih
 * pretvore u razmake ili u tekst "\\n"). Ovde se vraća u ispravan PEM oblik: zaglavlje,
 * sadržaj u redovima od 64 znaka, podnožje.
 */
function normalizePem(value: string): string {
  const body = value
    .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}

// Na globalThis, da razvojni server pri svakoj izmeni koda ne otvara novi skup veza.
const globalForDb = globalThis as unknown as { shopcrmDb?: Promise<Pool> };

/** Skup veza ka bazi; pri prvom pozivu pravi tabele. */
export function getDb(): Promise<Pool> {
  if (!globalForDb.shopcrmDb) {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL, DB_SSL_CA } = process.env;
    if (!DB_HOST || !DB_USER || !DB_NAME) {
      throw new Error(
        "Baza nije podešena: upišite DB_HOST, DB_USER, DB_PASSWORD i DB_NAME u .env.local.",
      );
    }
    const pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT ? Number(DB_PORT) : 3306,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      charset: "utf8mb4",
      // Baze u oblaku traže šifrovanu vezu. DB_SSL_CA je sertifikat provajdera (ceo PEM tekst);
      // DB_SSL=true je dovoljno kada provajder koristi javno priznat sertifikat.
      ssl: DB_SSL_CA ? { ca: normalizePem(DB_SSL_CA) } : DB_SSL === "true" ? {} : undefined,
      // Vreme se čuva i čita kao UTC, nezavisno od podešavanja servera.
      timezone: "Z",
      connectionLimit: 5,
    });
    globalForDb.shopcrmDb = createSchema(pool).then(
      () => pool,
      (error) => {
        // Sledeći zahtev pokušava ponovo, npr. kada se baza u međuvremenu pokrene.
        globalForDb.shopcrmDb = undefined;
        void pool.end().catch(() => {});
        throw error;
      },
    );
  }
  return globalForDb.shopcrmDb;
}
