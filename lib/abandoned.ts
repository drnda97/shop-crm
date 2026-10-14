import { contentWords, shopT } from "@/lib/i18n/server";
import { langPrefix, localPath } from "@/lib/routes";
import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { toLines, type CartItem } from "@/lib/cart";
import { currentPrice, variantLabel } from "@/lib/catalog";
import { getProductsBySlugs, getSettings } from "@/lib/content";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { isLoopbackUrl, publicBase } from "@/lib/mail";
import { currencyOf, type Settings } from "@/lib/settings";
import { accentText, readableOn } from "@/lib/theme";

/**
 * Napuštene korpe: kupac koji je na stranici plaćanja upisao email, a nije poručio, dobija
 * jedan podsetnik sa linkom koji mu vraća korpu. Radi samo kada je uključeno u panelu
 * (Napuštene korpe) i kada je email povezan. Samo za server.
 */

export type AbandonedCart = {
  token: string;
  email: string;
  firstName: string;
  items: CartItem[];
  /** Vrednost korpe u trenutku poslednje izmene. */
  value: number;
  updatedAt: string;
  remindedAt?: string;
  unsubscribed: boolean;
  /** Jezik sajta na kom je kupac punio korpu; na njemu stiže podsetnik. */
  lang?: string;
};

/** Koliko dana se korpa čuva; starija se briše. */
const KEEP_DAYS = 30;
/** Posle koliko dana se podsetnik više ne šalje: kupac je odavno otišao. */
const REMIND_WITHIN_DAYS = 7;

function toCart(row: RowDataPacket): AbandonedCart {
  return {
    token: row.token,
    email: row.email,
    firstName: row.first_name,
    items: JSON.parse(row.items),
    value: row.value,
    updatedAt: (row.updated_at as Date).toISOString(),
    ...(row.reminded_at ? { remindedAt: (row.reminded_at as Date).toISOString() } : {}),
    unsubscribed: row.unsubscribed === 1,
    ...(row.lang ? { lang: row.lang } : {}),
  };
}

/**
 * Pamti korpu uz email kupca (jedna korpa po adresi). Poziva se sa stranice plaćanja dok kupac
 * popunjava formu. Odjava od podsetnika ostaje i kada kupac ponovo dođe.
 */
export async function saveCart(input: { email: string; firstName: string; items: CartItem[]; siteUrl: string; lang?: string }) {
  const lines = toLines(input.items, await getProductsBySlugs(input.items.map((item) => item.slug)));
  if (lines.length === 0) return;
  const items = lines.map((line) => ({ slug: line.product.slug, qty: line.qty, ...(line.variant ? { variant: line.variant.id } : {}) }));
  const value = lines.reduce((sum, line) => sum + (currentPrice(line.product, line.variant) ?? 0) * line.qty, 0);
  const now = new Date();
  await (
    await getDb()
  ).query(
    `INSERT INTO abandoned_carts (token, email, first_name, site_url, items, value, created_at, updated_at, lang)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), site_url = VALUES(site_url),
       items = VALUES(items), value = VALUES(value), updated_at = VALUES(updated_at), lang = VALUES(lang)`,
    [randomBytes(24).toString("hex"), input.email, input.firstName.slice(0, 100), input.siteUrl.slice(0, 255), JSON.stringify(items), value, now, now, input.lang ?? null],
  );
}

/** Kupac je poručio: korpa više nije napuštena. Odjava od podsetnika se pamti. */
export async function clearCart(email: string) {
  const db = await getDb();
  await db.query("DELETE FROM abandoned_carts WHERE email = ? AND unsubscribed = 0", [email.trim().toLowerCase()]);
  await db.query("UPDATE abandoned_carts SET items = '[]', value = 0 WHERE email = ?", [email.trim().toLowerCase()]);
}

export async function getCartByToken(token: string): Promise<AbandonedCart | null> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT * FROM abandoned_carts WHERE token = ?", [token]);
  return rows.length > 0 ? toCart(rows[0]) : null;
}

export async function unsubscribeCart(token: string): Promise<boolean> {
  if (!/^[0-9a-f]{48}$/.test(token)) return false;
  const [changed] = await (
    await getDb()
  ).query<ResultSetHeader>("UPDATE abandoned_carts SET unsubscribed = 1 WHERE token = ?", [token]);
  return changed.affectedRows > 0;
}

/** Korpe za panel, najnovije prve; bez praznih (kupac je poručio ili se odjavio pre nego što je išta dodao). */
export async function listCarts(limit = 100): Promise<AbandonedCart[]> {
  const [rows] = await (
    await getDb()
  ).query<RowDataPacket[]>("SELECT * FROM abandoned_carts WHERE items <> '[]' ORDER BY updated_at DESC LIMIT ?", [limit]);
  return rows.map(toCart);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Tekst i HTML podsetnika. Proizvodi i cene su iz kataloga u trenutku slanja. */
export async function renderReminder(cart: AbandonedCart, settings: Settings, baseUrl: string) {
  const { store, colors, abandoned } = settings;
  const currency = currencyOf(settings);
  const lines = toLines(cart.items, await getProductsBySlugs(cart.items.map((item) => item.slug)));
  if (lines.length === 0) return null;

  const lang = cart.lang ?? store.language;
  const [t, words] = await Promise.all([shopT(lang), contentWords(lang)]);
  const local = (path: string) => localPath(lang, path, langPrefix(lang, store.language));
  const fill = (text: string) => text.replace(/\{ime\}/g, cart.firstName || "").replace(/\{prodavnica\}/g, store.name).replace(/ ,/g, ",").trim();
  const message = fill(words.get(abandoned.text) ?? abandoned.text);
  const link = `${baseUrl}${local(`/korpa/vrati/${cart.token}`)}`;
  const stop = `${baseUrl}${local(`/korpa/odjava/${cart.token}`)}`;
  const rows = lines.map((line) => ({
    name: line.variant ? `${line.product.name} — ${variantLabel(line.variant)}` : line.product.name,
    qty: line.qty,
    price: formatMoney((currentPrice(line.product, line.variant) ?? 0) * line.qty, currency),
  }));

  const html = `<!doctype html><html lang="${t("sr")}"><body style="margin:0;padding:24px;background:${colors.surface};font-family:Helvetica,Arial,sans-serif;color:${colors.text};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:100%;background:${colors.background};">
<tr><td style="padding:32px 32px 8px;font-size:22px;font-weight:bold;">${escapeHtml(store.name)}</td></tr>
<tr><td style="padding:8px 32px 16px;font-size:16px;line-height:1.6;">${escapeHtml(message).replace(/\n/g, "<br>")}</td></tr>
<tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
${rows.map((row) => `<tr><td style="padding:8px 0;border-top:1px solid ${colors.surface};">${row.qty} × ${escapeHtml(row.name)}</td><td align="right" style="padding:8px 0;border-top:1px solid ${colors.surface};white-space:nowrap;">${escapeHtml(row.price)}</td></tr>`).join("\n")}
</table></td></tr>
<tr><td style="padding:24px 32px;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:${colors.accent};color:${readableOn(colors.accent, colors.text, colors.background, "#ffffff")};font-weight:bold;text-decoration:none;">${t("Završite porudžbinu")}</a></td></tr>
<tr><td style="padding:0 32px 32px;font-size:12.5px;line-height:1.6;color:${accentText({ ...colors, accent: colors.text })};">${t("Ovu poruku ste dobili jer ste upisali email na stranici plaćanja. Šaljemo je samo jednom.")} <a href="${escapeHtml(stop)}" style="color:inherit;">${t("Ne želim podsetnike")}</a>.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    message,
    "",
    ...rows.map((row) => `${row.qty} × ${row.name} — ${row.price}`),
    "",
    `${t("Završite porudžbinu")}: ${link}`,
    "",
    `${t("Ne želite podsetnike?")} ${stop}`,
  ].join("\n");

  return { subject: `${fill(words.get(abandoned.subject) ?? abandoned.subject)} — ${store.name}`, html, text, stop };
}

/**
 * Javna adresa sajta za linkove u poruci: PUBLIC_URL ili adresa sajta iz Podešavanja. Adresa sa
 * koje je korpa stigla važi samo kada je lokalna — inače je mogla doći iz podmetnutog zaglavlja.
 */
function baseFor(settings: Settings, siteUrl: string): string {
  return publicBase(settings, isLoopbackUrl(siteUrl) ? siteUrl : "");
}

/**
 * Šalje podsetnike korpama kojima je vreme: starijim od zadatog broja sati, bez porudžbine,
 * bez ranijeg podsetnika i bez odjave. Briše korpe starije od mesec dana.
 * Vraća broj poslatih poruka; pokreće se po rasporedu (instrumentation.ts) ili sa /api/v1/cron.
 */
export async function sendDueReminders(now = new Date()): Promise<number> {
  const db = await getDb();
  await db.query("DELETE FROM abandoned_carts WHERE updated_at < ?", [new Date(now.getTime() - KEEP_DAYS * 86_400_000)]);

  const settings = await getSettings();
  const { abandoned, mail, store } = settings;
  if (!abandoned.enabled || mail.smtpHost === "") return 0;

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT * FROM abandoned_carts
     WHERE reminded_at IS NULL AND unsubscribed = 0 AND items <> '[]' AND updated_at <= ? AND updated_at >= ?
     ORDER BY updated_at LIMIT 50`,
    [new Date(now.getTime() - abandoned.delayHours * 3_600_000), new Date(now.getTime() - REMIND_WITHIN_DAYS * 86_400_000)],
  );
  if (rows.length === 0) return 0;

  const transport = nodemailer.createTransport({
    host: mail.smtpHost,
    port: mail.smtpPort,
    secure: mail.smtpPort === 465,
    auth: mail.smtpUser ? { user: mail.smtpUser, pass: mail.smtpPassword } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  let sent = 0;
  for (const row of rows) {
    // Oznaka se upisuje pre slanja, uz uslov: dva procesa ne šalju istoj korpi.
    const [claimed] = await db.query<ResultSetHeader>(
      "UPDATE abandoned_carts SET reminded_at = ? WHERE id = ? AND reminded_at IS NULL",
      [now, row.id],
    );
    if (claimed.affectedRows === 0) continue;
    const base = baseFor(settings, row.site_url);
    const message = base ? await renderReminder(toCart(row), settings, base) : null;
    // Korpa čijih proizvoda više nema ostaje označena: nema šta da se pošalje.
    if (!message) continue;
    try {
      await transport.sendMail({
        from: { name: mail.fromName || store.name, address: mail.fromEmail || mail.smtpUser },
        to: row.email,
        replyTo: mail.sellerEmail || undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: { "List-Unsubscribe": `<${message.stop}>` },
      });
      sent++;
    } catch (error) {
      // Slanje nije uspelo: korpa se vraća u red, pa će pokušaj biti ponovljen.
      console.error(`[napuštena korpa] email nije poslat: ${error instanceof Error ? error.message : error}`);
      await db.query("UPDATE abandoned_carts SET reminded_at = NULL WHERE id = ?", [row.id]);
    }
  }
  transport.close();
  return sent;
}
