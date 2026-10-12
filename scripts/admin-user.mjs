// Vraća pristup panelu kada se vlasnik zaključa (zaboravljena lozinka, izgubljen telefon).
//
//   npm run admin:user -- <korisnicko-ime> <nova-lozinka>
//
// Ako korisnik postoji: postavlja mu lozinku, uključuje nalog, daje ulogu vlasnika, isključuje
// prijavu u dva koraka i odjavljuje ga sa svih uređaja. Ako ne postoji, pravi novog vlasnika.
// Podatke za bazu čita iz .env.local; pokreće se na serveru, pa je sme pokrenuti samo onaj ko
// ionako ima pristup bazi.
import mysql from "mysql2/promise";
import { hashPassword } from "../lib/password.ts";

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error("Baza nije podešena: upišite DB_HOST, DB_USER, DB_PASSWORD i DB_NAME u .env.local.");
  process.exit(1);
}

const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 10) {
  console.error("Upotreba: npm run admin:user -- <korisnicko-ime> <nova-lozinka>  (lozinka najmanje 10 znakova)");
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: DB_HOST,
  port: Number(DB_PORT || 3306),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

try {
  const name = username.toLowerCase();
  const [rows] = await connection.query("SELECT id FROM admin_users WHERE username = ?", [name]);
  if (rows.length > 0) {
    const id = rows[0].id;
    await connection.query(
      "UPDATE admin_users SET pass_hash = ?, role = 'owner', disabled = 0, totp_enabled = 0, totp_secret = NULL, recovery_codes = NULL WHERE id = ?",
      [hashPassword(password), id],
    );
    await connection.query("DELETE FROM admin_sessions WHERE user_id = ?", [id]);
    console.log(`Korisnik ${name} je sada vlasnik sa novom lozinkom; prijava u dva koraka je isključena.`);
  } else {
    await connection.query(
      "INSERT INTO admin_users (username, name, pass_hash, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
      [name, name, hashPassword(password), new Date()],
    );
    console.log(`Napravljen je vlasnik ${name}.`);
  }
} catch (error) {
  console.error(
    error?.code === "ER_NO_SUCH_TABLE"
      ? "Tabele još ne postoje: pokrenite aplikaciju jednom (npm run dev ili npm start), pa ponovite."
      : error,
  );
  process.exitCode = 1;
} finally {
  await connection.end();
}
