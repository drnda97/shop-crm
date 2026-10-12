import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { syncVariants } from "@/lib/catalog";
import { DEFAULT_PAGES } from "@/lib/default-pages";
import { normalizeSections } from "@/lib/sections";

/**
 * Izmene šeme baze posle prve verzije. Tabele iz lib/db.ts (TABLES) su polazno stanje i
 * više se ne menjaju: svaka nova kolona, tabela ili prepis podataka je nova migracija ovde.
 *
 * Pri pokretanju se izvrše redom one koje ova baza još nema; šta je izvršeno piše u tabeli
 * schema_migrations. Tako i nova i postojeća prodavnica stignu do iste šeme, bez gubitka podataka.
 *
 * Pravila:
 * - Nova migracija ide na kraj, sa sledećim brojem. Jednom objavljena se ne menja i ne briše.
 * - MySQL ne vraća izmene šeme pri grešci, pa jedna migracija treba da radi jednu stvar:
 *   ako stane na pola, ostatak se ispravlja ručno.
 */
export type Migration = {
  id: number;
  /** Kratak opis, za tabelu schema_migrations. */
  name: string;
  up: (connection: PoolConnection) => Promise<void>;
};

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "stranice: sekcije, SEO i nacrt",
    up: async (connection) => {
      await connection.query(
        `ALTER TABLE pages
          ADD COLUMN sections MEDIUMTEXT NULL,
          ADD COLUMN seo_title VARCHAR(255) NOT NULL DEFAULT '',
          ADD COLUMN seo_description VARCHAR(500) NOT NULL DEFAULT '',
          ADD COLUMN published TINYINT(1) NOT NULL DEFAULT 1`,
      );
    },
  },
  {
    id: 2,
    name: "stranice: tekst i fotografije iz prve verzije postaju sekcije",
    up: async (connection) => {
      const [pages] = await connection.query<RowDataPacket[]>(
        "SELECT slug, body FROM pages WHERE sections IS NULL",
      );
      const [images] = await connection.query<RowDataPacket[]>(
        "SELECT page_slug, src, alt FROM page_images ORDER BY position",
      );
      for (const page of pages) {
        const sections = normalizeSections([
          { id: "text", type: "text", data: { heading: "", body: page.body } },
          ...images
            .filter((image) => image.page_slug === page.slug)
            .map((image) => ({
              id: "photo",
              type: "photo",
              data: { image: { src: image.src, alt: image.alt } },
            })),
        ]);
        await connection.query("UPDATE pages SET sections = ? WHERE slug = ?", [
          JSON.stringify(sections),
          page.slug,
        ]);
      }
    },
  },
  {
    id: 3,
    name: "stranice: početni sadržaj sajta",
    up: async (connection) => {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT slug, position FROM pages",
      );
      const taken = new Set(rows.map((row) => row.slug as string));
      let position = Math.max(-1, ...rows.map((row) => Number(row.position)));
      // Stranica koju je vlasnik već napravio pod istom adresom ostaje njegova.
      for (const page of DEFAULT_PAGES.filter((candidate) => !taken.has(candidate.slug))) {
        position += 1;
        await connection.query(
          `INSERT INTO pages (slug, position, title, body, show_in_footer, sections, seo_title,
            seo_description, published) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)`,
          [
            page.slug,
            position,
            page.title,
            page.showInFooter,
            JSON.stringify(page.sections),
            page.seoTitle,
            page.seoDescription,
            page.published,
          ],
        );
      }
    },
  },
  {
    id: 4,
    name: "proizvodi: opcije i istaknuti deo stranice",
    up: async (connection) => {
      await connection.query(
        "ALTER TABLE products ADD COLUMN options TEXT NULL, ADD COLUMN highlight TEXT NULL",
      );
    },
  },
  {
    id: 5,
    name: "podešavanja: boje iz prve verzije ustupaju mesto bojama teme",
    up: async (connection) => {
      // Do sada su boje važile samo za email, sa plavim akcentom kao početnom vrednošću. Od sada
      // boje sajt i email, pa netaknuta početna paleta prelazi na boje teme; izmenjena ostaje.
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT value FROM settings WHERE name = 'settings'",
      );
      if (rows.length === 0) return;
      const settings = JSON.parse(rows[0].value);
      const old = { background: "#ffffff", surface: "#f4f4f2", text: "#1b1b1f", accent: "#2f5bd7" };
      const untouched = Object.entries(old).every(
        ([key, value]) => String(settings.colors?.[key] ?? value).toLowerCase() === value,
      );
      if (!untouched) return;
      delete settings.colors;
      await connection.query("UPDATE settings SET value = ? WHERE name = 'settings'", [
        JSON.stringify(settings),
      ]);
    },
  },
  {
    id: 6,
    name: "proizvodi: varijante",
    up: async (connection) => {
      await connection.query(
        `CREATE TABLE IF NOT EXISTS product_variants (
          product_slug VARCHAR(191) NOT NULL,
          id VARCHAR(120) NOT NULL,
          position INT NOT NULL,
          option_values TEXT NOT NULL,
          price INT NULL,
          sale_price INT NULL,
          sku VARCHAR(64) NOT NULL DEFAULT '',
          stock_qty INT NULL,
          image VARCHAR(255) NULL,
          enabled TINYINT(1) NOT NULL DEFAULT 1,
          PRIMARY KEY (product_slug, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );
    },
  },
  {
    id: 7,
    name: "proizvodi: postojeće opcije dobijaju varijante",
    up: async (connection) => {
      // Opcije su do sada bile samo izbor koji ide u napomenu; svaka kombinacija postaje
      // varijanta bez sopstvene cene i stanja, pa se za kupca ništa ne menja.
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT slug, options FROM products WHERE options IS NOT NULL AND options <> '[]'",
      );
      for (const row of rows) {
        const variants = syncVariants(JSON.parse(row.options), []);
        for (const [index, variant] of variants.entries()) {
          await connection.query(
            `INSERT IGNORE INTO product_variants (product_slug, id, position, option_values)
             VALUES (?, ?, ?, ?)`,
            [row.slug, variant.id, index, JSON.stringify(variant.values)],
          );
        }
      }
    },
  },
  {
    id: 8,
    name: "porudžbine: naziv varijante uz stavku",
    up: async (connection) => {
      await connection.query(
        "ALTER TABLE order_items ADD COLUMN variant VARCHAR(255) NOT NULL DEFAULT ''",
      );
    },
  },
  {
    id: 9,
    name: "katalog: podkategorije, više kategorija, SEO, slični proizvodi",
    up: async (connection) => {
      await connection.query(
        `ALTER TABLE categories
          ADD COLUMN parent VARCHAR(191) NOT NULL DEFAULT '',
          ADD COLUMN description TEXT NULL,
          ADD COLUMN seo_title VARCHAR(255) NOT NULL DEFAULT '',
          ADD COLUMN seo_description VARCHAR(500) NOT NULL DEFAULT ''`,
      );
      await connection.query(
        `ALTER TABLE products
          ADD COLUMN seo_title VARCHAR(255) NOT NULL DEFAULT '',
          ADD COLUMN seo_description VARCHAR(500) NOT NULL DEFAULT '',
          ADD COLUMN related TEXT NULL`,
      );
      await connection.query(
        `CREATE TABLE IF NOT EXISTS product_categories (
          product_slug VARCHAR(191) NOT NULL,
          category_id VARCHAR(191) NOT NULL,
          position INT NOT NULL,
          PRIMARY KEY (product_slug, category_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );
      // Dosadašnja jedina kategorija proizvoda postaje njegova glavna (prva) kategorija.
      await connection.query(
        `INSERT IGNORE INTO product_categories (product_slug, category_id, position)
         SELECT slug, category, 0 FROM products WHERE category <> ''`,
      );
    },
  },
  {
    id: 10,
    name: "stanje: varijanta uz stavku porudžbine i istorija promena",
    up: async (connection) => {
      // Id varijante uz stavku: otkazivanje porudžbine vraća komade na stanje te varijante.
      await connection.query(
        "ALTER TABLE order_items ADD COLUMN variant_id VARCHAR(120) NOT NULL DEFAULT ''",
      );
      await connection.query(
        `CREATE TABLE IF NOT EXISTS stock_log (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          at DATETIME(3) NOT NULL,
          product_slug VARCHAR(191) NOT NULL,
          variant_id VARCHAR(120) NOT NULL DEFAULT '',
          change_qty INT NOT NULL,
          qty_after INT NULL,
          reason VARCHAR(255) NOT NULL,
          KEY stock_log_product (product_slug, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );
    },
  },
  {
    id: 11,
    name: "porudžbine: način dostave, praćenje, uplata, povraćaj, PDV i istorija",
    up: async (connection) => {
      await connection.query(
        `ALTER TABLE orders
          ADD COLUMN delivery_method VARCHAR(191) NOT NULL DEFAULT '',
          ADD COLUMN pickup TINYINT(1) NOT NULL DEFAULT 0,
          ADD COLUMN tracking_number VARCHAR(100) NOT NULL DEFAULT '',
          ADD COLUMN tracking_url VARCHAR(500) NOT NULL DEFAULT '',
          ADD COLUMN paid_at DATETIME(3) NULL,
          ADD COLUMN payment_ref VARCHAR(191) NOT NULL DEFAULT '',
          ADD COLUMN refunded INT NOT NULL DEFAULT 0,
          ADD COLUMN tax_percent DECIMAL(5,2) NULL`,
      );
      // Preuzimanje se do sada prepoznavalo po početku napomene.
      await connection.query(
        "UPDATE orders SET pickup = 1, delivery_method = 'Preuzimanje u salonu' WHERE note LIKE 'Preuzimanje u salonu.%'",
      );
      await connection.query(
        `CREATE TABLE IF NOT EXISTS order_events (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          order_number INT NOT NULL,
          at DATETIME(3) NOT NULL,
          text VARCHAR(500) NOT NULL,
          KEY order_events_order (order_number, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );
    },
  },
  {
    id: 12,
    name: "povraćaj po stavkama i napuštene korpe",
    up: async (connection) => {
      // Koliko je komada stavke kupac vratio: vraćeni komadi su već na stanju, pa ih
      // otkazivanje porudžbine ne vraća drugi put.
      await connection.query("ALTER TABLE order_items ADD COLUMN returned INT NOT NULL DEFAULT 0");
      await connection.query(
        `CREATE TABLE IF NOT EXISTS abandoned_carts (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          token CHAR(48) NOT NULL,
          email VARCHAR(191) NOT NULL,
          first_name VARCHAR(100) NOT NULL DEFAULT '',
          site_url VARCHAR(255) NOT NULL DEFAULT '',
          items TEXT NOT NULL,
          value INT NOT NULL DEFAULT 0,
          created_at DATETIME(3) NOT NULL,
          updated_at DATETIME(3) NOT NULL,
          reminded_at DATETIME(3) NULL,
          unsubscribed TINYINT(1) NOT NULL DEFAULT 0,
          UNIQUE KEY abandoned_carts_email (email),
          UNIQUE KEY abandoned_carts_token (token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );
    },
  },
  {
    id: 13,
    name: "popusti: fiksni iznos, besplatna dostava, proizvodi i kategorije, automatski popust",
    up: async (connection) => {
      await connection.query(
        `ALTER TABLE discounts
          ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'percent',
          ADD COLUMN amount INT NOT NULL DEFAULT 0,
          ADD COLUMN products TEXT NULL,
          ADD COLUMN categories TEXT NULL`,
      );
      // Uz porudžbinu: naslov popusta (automatski popust nema kod) i njegov id, za brojanje korišćenja.
      await connection.query(
        `ALTER TABLE orders
          ADD COLUMN discount_name VARCHAR(255) NULL,
          ADD COLUMN discount_id VARCHAR(191) NULL,
          ADD COLUMN discount_shipping TINYINT(1) NOT NULL DEFAULT 0`,
      );
    },
  },
  {
    id: 14,
    name: "kupci: adresa i nova lozinka, zahtevi za povrat, utisci, slanje novosti",
    up: async (connection) => {
      const tail = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
      await connection.query(
        `ALTER TABLE shop_users
          ADD COLUMN phone VARCHAR(64) NOT NULL DEFAULT '',
          ADD COLUMN street VARCHAR(255) NOT NULL DEFAULT '',
          ADD COLUMN city VARCHAR(255) NOT NULL DEFAULT '',
          ADD COLUMN postal_code VARCHAR(16) NOT NULL DEFAULT ''`,
      );
      // Zahtev za novu lozinku: u bazi je heš žetona iz linka, sa rokom važenja.
      await connection.query(
        `CREATE TABLE IF NOT EXISTS password_resets (
          token_hash CHAR(64) NOT NULL PRIMARY KEY,
          user_id INT NOT NULL,
          expires_at DATETIME(3) NOT NULL,
          KEY password_resets_user (user_id)
        ) ${tail}`,
      );
      await connection.query(
        `CREATE TABLE IF NOT EXISTS return_requests (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          order_number INT NOT NULL,
          created_at DATETIME(3) NOT NULL,
          items TEXT NOT NULL,
          reason TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'new',
          answer TEXT NULL,
          resolved_at DATETIME(3) NULL,
          KEY return_requests_order (order_number),
          KEY return_requests_status (status)
        ) ${tail}`,
      );
      await connection.query(
        `CREATE TABLE IF NOT EXISTS reviews (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          product_slug VARCHAR(191) NOT NULL,
          user_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          rating TINYINT NOT NULL,
          body TEXT NOT NULL,
          created_at DATETIME(3) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          verified TINYINT(1) NOT NULL DEFAULT 0,
          UNIQUE KEY reviews_user_product (user_id, product_slug),
          KEY reviews_product (product_slug, status)
        ) ${tail}`,
      );
      // Novosti: žeton za link za odjavu u svakoj poruci, i evidencija poslatih poruka.
      await connection.query(
        `ALTER TABLE shop_subscribers
          ADD COLUMN token CHAR(48) NULL,
          ADD COLUMN unsubscribed TINYINT(1) NOT NULL DEFAULT 0`,
      );
      await connection.query(
        `CREATE TABLE IF NOT EXISTS campaigns (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          subject VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          created_at DATETIME(3) NOT NULL,
          recipients INT NOT NULL DEFAULT 0,
          sent INT NOT NULL DEFAULT 0,
          failed INT NOT NULL DEFAULT 0,
          finished_at DATETIME(3) NULL
        ) ${tail}`,
      );
    },
  },
  {
    id: 15,
    name: "panel: korisnici sa ulogama, sesije i dnevnik izmena",
    up: async (connection) => {
      const tail = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
      await connection.query(
        `CREATE TABLE IF NOT EXISTS admin_users (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) NOT NULL,
          name VARCHAR(100) NOT NULL,
          pass_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL,
          totp_secret VARCHAR(64) NULL,
          totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
          recovery_codes TEXT NULL,
          disabled TINYINT(1) NOT NULL DEFAULT 0,
          created_at DATETIME(3) NOT NULL,
          last_login_at DATETIME(3) NULL,
          UNIQUE KEY admin_users_username (username)
        ) ${tail}`,
      );
      await connection.query(
        `CREATE TABLE IF NOT EXISTS admin_sessions (
          token_hash CHAR(64) NOT NULL PRIMARY KEY,
          user_id INT NOT NULL,
          expires_at DATETIME(3) NOT NULL,
          KEY admin_sessions_user (user_id)
        ) ${tail}`,
      );
      await connection.query(
        `CREATE TABLE IF NOT EXISTS audit_log (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          at DATETIME(3) NOT NULL,
          user_id INT NOT NULL,
          user_name VARCHAR(100) NOT NULL,
          action VARCHAR(191) NOT NULL,
          detail VARCHAR(500) NOT NULL DEFAULT '',
          KEY audit_log_at (at)
        ) ${tail}`,
      );
    },
  },
  {
    id: 16,
    name: "veza sa spoljnim sistemima: API ključevi i webhook-ovi",
    up: async (connection) => {
      const tail = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
      await connection.query(
        `CREATE TABLE IF NOT EXISTS api_keys (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          key_hash CHAR(64) NOT NULL,
          prefix VARCHAR(16) NOT NULL,
          scope VARCHAR(10) NOT NULL,
          created_at DATETIME(3) NOT NULL,
          last_used_at DATETIME(3) NULL,
          UNIQUE KEY api_keys_hash (key_hash)
        ) ${tail}`,
      );
      await connection.query(
        `CREATE TABLE IF NOT EXISTS webhooks (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          url VARCHAR(500) NOT NULL,
          secret VARCHAR(64) NOT NULL,
          events VARCHAR(500) NOT NULL,
          active TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME(3) NOT NULL,
          last_at DATETIME(3) NULL,
          last_status INT NULL,
          last_error VARCHAR(255) NULL
        ) ${tail}`,
      );
    },
  },
];

// GET_LOCK važi za ceo MySQL server, pa ime sadrži i bazu (najviše 64 znaka).
const LOCK_NAME = `shopcrm-migrations:${process.env.DB_NAME ?? ""}`.slice(0, 64);

/** Migracije koje baza još nema, redom po broju. */
export function pendingMigrations(migrations: Migration[], applied: Set<number>): Migration[] {
  const ids = new Set<number>();
  for (const { id } of migrations) {
    if (!Number.isInteger(id) || id < 1) throw new Error(`Migracija ima neispravan broj: ${id}.`);
    if (ids.has(id)) throw new Error(`Dve migracije imaju isti broj: ${id}.`);
    ids.add(id);
  }
  return migrations.filter((migration) => !applied.has(migration.id)).sort((a, b) => a.id - b.id);
}

export async function runMigrations(pool: Pool, migrations: Migration[] = MIGRATIONS) {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at DATETIME(3) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
    // Zaključavanje na nivou baze: dva procesa pokrenuta u istom trenutku ne izvršavaju istu migraciju.
    const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 30) AS locked", [
      LOCK_NAME,
    ]);
    if (Number(lock[0]?.locked) !== 1) {
      throw new Error("Migracije baze su zauzete u drugom procesu. Pokušajte ponovo.");
    }
    try {
      const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM schema_migrations");
      const applied = new Set(rows.map((row) => Number(row.id)));
      for (const migration of pendingMigrations(migrations, applied)) {
        await migration.up(connection);
        await connection.query(
          "INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)",
          [migration.id, migration.name, new Date()],
        );
      }
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]);
    }
  } finally {
    connection.release();
  }
}
