import nodemailer from "nodemailer";
import type { Settings } from "@/lib/settings";
import { accentText, readableOn } from "@/lib/theme";

/**
 * Obične poruke kupcu (nova lozinka, odgovor na zahtev za povrat, novosti): kratak tekst u
 * bojama prodavnice, po želji sa dugmetom. Email o porudžbini ima svoj šablon (lib/order-email.ts).
 * Šalje se preko SMTP naloga iz Podešavanja. Samo za server.
 */

export function isMailReady(settings: Settings): boolean {
  return settings.mail.smtpHost !== "";
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type SimpleEmail = {
  /** Tekst poruke; prazan red razdvaja pasuse. */
  message: string;
  button?: { label: string; url: string };
  /** Sitan tekst na dnu, npr. zašto je poruka stigla; `link` je adresa za odjavu. */
  footer?: { text: string; link?: { label: string; url: string } };
};

/** HTML i tekstualni oblik poruke. Sve što stiže spolja prolazi kroz escapeHtml. */
export function simpleEmail(settings: Settings, { message, button, footer }: SimpleEmail): { html: string; text: string } {
  const { store, colors } = settings;
  const paragraphs = message.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const html = `<!doctype html><html lang="sr"><body style="margin:0;padding:24px;background:${colors.surface};font-family:Helvetica,Arial,sans-serif;color:${colors.text};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:100%;background:${colors.background};">
<tr><td style="padding:32px 32px 8px;font-size:22px;font-weight:bold;">${escapeHtml(store.name)}</td></tr>
${paragraphs.map((part) => `<tr><td style="padding:8px 32px;font-size:16px;line-height:1.6;">${escapeHtml(part).replace(/\n/g, "<br>")}</td></tr>`).join("\n")}
${button ? `<tr><td style="padding:16px 32px 8px;"><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:${colors.accent};color:${readableOn(colors.accent, colors.text, colors.background, "#ffffff")};font-weight:bold;text-decoration:none;">${escapeHtml(button.label)}</a></td></tr>` : ""}
<tr><td style="padding:16px 32px 32px;font-size:12.5px;line-height:1.6;color:${accentText({ ...colors, accent: colors.text })};">${
    footer ? `${escapeHtml(footer.text)}${footer.link ? ` <a href="${escapeHtml(footer.link.url)}" style="color:inherit;">${escapeHtml(footer.link.label)}</a>.` : ""}` : escapeHtml([store.phone, store.email].filter(Boolean).join(" · "))
  }</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    ...paragraphs,
    ...(button ? [`${button.label}: ${button.url}`] : []),
    ...(footer ? [`${footer.text}${footer.link ? ` ${footer.link.label}: ${footer.link.url}` : ""}`] : []),
  ].join("\n\n");
  return { html, text };
}

export type Outgoing = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> };

/**
 * Šalje poruke jednu po jednu preko iste veze. Vraća broj poslatih i greške po adresi.
 * Bez povezanog emaila ne šalje ništa.
 */
export async function sendMails(settings: Settings, messages: Outgoing[]): Promise<{ sent: number; errors: string[] }> {
  if (!isMailReady(settings) || messages.length === 0) return { sent: 0, errors: [] };
  const { mail, store } = settings;
  const transport = nodemailer.createTransport({
    host: mail.smtpHost,
    port: mail.smtpPort,
    // Port 465 šifruje vezu od početka; ostali prelaze na šifrovanu kada server to ponudi.
    secure: mail.smtpPort === 465,
    auth: mail.smtpUser ? { user: mail.smtpUser, pass: mail.smtpPassword } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  let sent = 0;
  const errors: string[] = [];
  for (const message of messages) {
    try {
      await transport.sendMail({
        from: { name: mail.fromName || store.name, address: mail.fromEmail || mail.smtpUser },
        replyTo: mail.sellerEmail || undefined,
        ...message,
      });
      sent++;
    } catch (error) {
      errors.push(`${message.to}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  transport.close();
  return { sent, errors };
}

/** Javna adresa sajta za linkove u porukama koje se šalju van zahteva (novosti); prazno kada nije poznata. */
export function publicBase(settings: Settings, fallback = ""): string {
  return (process.env.PUBLIC_URL || settings.store.storefrontUrl || fallback).replace(/\/+$/, "");
}
