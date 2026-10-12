import { localPath } from "@/lib/routes";
import { makeT } from "@/lib/i18n";
import { shopDict } from "@/lib/i18n/shop";
import { randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getSettings } from "@/lib/content";
import { getDb } from "@/lib/db";
import { sendMails, simpleEmail } from "@/lib/mail";

/**
 * Novosti: poruka svim prijavljenima, iz panela (Poruke → Novosti). Svaka poruka nosi link za
 * odjavu; odjavljena adresa ostaje u spisku da se ne bi ponovo prijavila sama. Samo za server.
 */

export type Campaign = {
  id: number;
  subject: string;
  body: string;
  createdAt: string;
  recipients: number;
  sent: number;
  failed: number;
  /** Slanje je završeno; dok nije, poruke još idu. */
  finished: boolean;
};

/** Prijavljeni koji primaju novosti, sa žetonom za odjavu (dodeljuje se pri prvom slanju). */
export async function getRecipients(): Promise<{ email: string; token: string }[]> {
  const db = await getDb();
  const [missing] = await db.query<RowDataPacket[]>("SELECT email FROM shop_subscribers WHERE token IS NULL");
  for (const row of missing) {
    await db.query("UPDATE shop_subscribers SET token = ? WHERE email = ? AND token IS NULL", [randomBytes(24).toString("hex"), row.email]);
  }
  const [rows] = await db.query<RowDataPacket[]>("SELECT email, token FROM shop_subscribers WHERE unsubscribed = 0 ORDER BY created_at");
  return rows.map((row) => ({ email: row.email, token: row.token }));
}

export async function unsubscribeNewsletter(token: string): Promise<boolean> {
  if (!/^[0-9a-f]{48}$/.test(token)) return false;
  const [changed] = await (await getDb()).query<ResultSetHeader>("UPDATE shop_subscribers SET unsubscribed = 1 WHERE token = ?", [token]);
  return changed.affectedRows > 0;
}

export async function getCampaigns(): Promise<Campaign[]> {
  const [rows] = await (await getDb()).query<RowDataPacket[]>("SELECT * FROM campaigns ORDER BY id DESC LIMIT 30");
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    body: row.body,
    createdAt: (row.created_at as Date).toISOString(),
    recipients: row.recipients,
    sent: row.sent,
    failed: row.failed,
    finished: row.finished_at !== null,
  }));
}

/** Upisuje poruku u evidenciju i vraća njen id; samo slanje ide posle (sendCampaign). */
export async function createCampaign(subject: string, body: string, recipients: number): Promise<number> {
  const [result] = await (
    await getDb()
  ).query<ResultSetHeader>("INSERT INTO campaigns (subject, body, created_at, recipients) VALUES (?, ?, ?, ?)", [subject, body, new Date(), recipients]);
  return result.insertId;
}

const BATCH = 20;

/**
 * Šalje poruku svim prijavljenima, u grupama, i upisuje koliko je poslato. `baseUrl` je javna
 * adresa sajta za link za odjavu. Traje onoliko koliko SMTP server prima poruke, pa se poziva
 * pošto panel dobije odgovor.
 */
export async function sendCampaign(id: number, baseUrl: string) {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT subject, body FROM campaigns WHERE id = ? AND finished_at IS NULL", [id]);
  if (rows.length === 0) return;
  const settings = await getSettings();
  const recipients = await getRecipients();
  const t = makeT(settings.store.language, shopDict);

  for (let start = 0; start < recipients.length; start += BATCH) {
    const messages = recipients.slice(start, start + BATCH).map(({ email, token }) => {
      const stop = `${baseUrl}${localPath(settings.store.language, `/novosti/odjava/${token}`)}`;
      return {
        to: email,
        subject: `${rows[0].subject} — ${settings.store.name}`,
        ...simpleEmail(settings, {
          message: rows[0].body,
          footer: { text: t("Ovu poruku ste dobili jer ste se prijavili na novosti."), link: { label: t("Odjavite se"), url: stop } },
        }),
        headers: { "List-Unsubscribe": `<${stop}>` },
      };
    });
    const { sent, errors } = await sendMails(settings, messages);
    await db.query("UPDATE campaigns SET sent = sent + ?, failed = failed + ? WHERE id = ?", [sent, messages.length - sent, id]);
    for (const error of errors) console.error(`[novosti ${id}] ${error}`);
  }
  await db.query("UPDATE campaigns SET finished_at = ? WHERE id = ?", [new Date(), id]);
}
