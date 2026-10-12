import { accentText } from "@/lib/theme";
import path from "node:path";
import nodemailer from "nodemailer";
import { getSettings, getStoredValue, setStoredValue, uploadPath } from "@/lib/content";
import { defaultEmailTemplate } from "@/lib/email-template";
import { formatMoney } from "@/lib/format";
import { invoiceFileName, invoicePdf } from "@/lib/invoice";
import { itemName, type Order } from "@/lib/orders";
import { currencyOf, STATUS_EMAILS, type Settings, type StatusEmailKey } from "@/lib/settings";

/**
 * Email o porudžbini: prodavcu obaveštenje, kupcu potvrda. Šalje se preko
 * SMTP naloga upisanog u admin panelu (Podešavanja). Samo za server.
 */

export type Recipient = "seller" | "customer";

/** Ime zapisa u tabeli settings pod kojim je šablon koji je vlasnik ubacio. */
const TEMPLATE_KEY = "email_template";
export const MAX_TEMPLATE_BYTES = 300 * 1024;
const LOGO_CID = "logo@shopcrm";

export async function saveCustomTemplate(html: string) {
  await setStoredValue(TEMPLATE_KEY, html);
}

export async function removeCustomTemplate() {
  await setStoredValue(TEMPLATE_KEY, null);
}

/** Šablon koji je vlasnik ubacio, ili naš ako svog nema. */
export async function getEmailTemplate(settings: Settings): Promise<string> {
  if (!settings.mail.customTemplate) return defaultEmailTemplate;
  return (await getStoredValue(TEMPLATE_KEY)) ?? defaultEmailTemplate;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type RenderInput = {
  template: string;
  order: Order;
  recipient: Recipient;
  settings: Settings;
  /** Poruka o promeni statusa: zamenjuje naslov, tekst i naslov emaila; ostatak (stavke, iznosi) ostaje. */
  notice?: { subject: string; title: string; message: string };
  /** Adresa slike logoa: `cid:` prilog pri slanju, javna putanja u pregledu. */
  logoSrc?: string;
};

export function renderOrderEmail({ template, order, recipient, settings, logoSrc, notice }: RenderInput) {
  const { customer } = order;
  const { store, colors, payment } = settings;
  const currency = currencyOf(settings);
  const amount = (value: number) => formatMoney(value, currency);
  const date = new Intl.DateTimeFormat(store.locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: store.timeZone,
  }).format(new Date(order.receivedAt));

  const bank = order.paymentMethod === "bank";
  const card = order.paymentMethod === "card";
  const title = notice?.title ?? (recipient === "seller" ? "Nova porudžbina" : "Hvala, porudžbina je primljena.");
  const message =
    notice?.message ??
    (recipient === "seller"
      ? `Stigla je nova porudžbina. Plaćanje: ${card ? "karticom" : bank ? "uplata na račun" : "pouzećem"}. Dostava: ${order.deliveryMethod}.`
      : card
        ? "Porudžbinu šaljemo kada uplata karticom bude potvrđena."
        : bank
          ? "Porudžbinu šaljemo kada uplata stigne. Podaci za uplatu su ispod."
          : "Javićemo vam se da potvrdimo porudžbinu i dan slanja. Ništa ne plaćate sada — iznos plaćate pri preuzimanju.");
  const totalLabel = order.paidAt ? "Plaćeno" : card ? "Za plaćanje karticom" : bank ? "Za uplatu" : "Za naplatu, pouzećem";
  const contact = [store.phone, store.email || settings.mail.sellerEmail]
    .filter(Boolean)
    .join(" · ");
  const address = `${customer.street}, ${customer.postalCode} ${customer.city}`;

  // Podaci za uplatu idu samo kupcu, i samo kada je izabrao uplatu na račun.
  const showBank = bank && !order.paidAt && recipient === "customer" && payment.bankInstructions !== "";
  const paymentBlock = showBank
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:${colors.surface};"><tr><td style="padding:18px 20px;font-size:15px;color:${colors.text};"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${accentText(colors)};padding-bottom:6px;">Podaci za uplatu</div>${escapeHtml(payment.bankInstructions).replace(/\n/g, "<br>")}<div style="padding-top:8px;">Iznos: <strong>${amount(order.total)}</strong> · poziv na broj: <strong>${escapeHtml(order.number)}</strong></div></td></tr></table>`
    : "";

  // Kod za sledeću kupovinu: kupcu istaknut okvir, prodavcu samo napomena da je poslat.
  const issued = order.issuedCode;
  let discountBlock = "";
  if (issued && recipient === "customer") {
    discountBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border:2px dashed ${colors.accent};"><tr><td align="center" style="padding:18px 20px;font-size:15px;color:${colors.text};"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${accentText(colors)};">Poklon za sledeću kupovinu</div><div style="padding:6px 0 0;font-size:24px;line-height:1.2;">${escapeHtml(issued.title)}</div><div style="padding:2px 0;font-size:17px;">${issued.percent}% popusta</div><div style="padding:6px 0;"><span style="display:inline-block;padding:8px 16px;background:${colors.text};color:${colors.background};font-family:'Courier New',monospace;font-size:20px;letter-spacing:3px;">${escapeHtml(issued.code)}</span></div><div>Upišite kod pri sledećoj porudžbini. Važi za jednu kupovinu, uz isti email ili telefon.</div></td></tr></table>`;
  } else if (issued) {
    discountBlock = `<p style="margin:16px 0 0;font-size:15px;">Kupcu je uz potvrdu poslat kod <strong>${escapeHtml(issued.code)}</strong> za ${issued.percent}% popusta pri sledećoj kupovini.</p>`;
  }
  const discountRow = order.discount
    ? `<tr><td style="padding:2px 0;">Popust ${order.discount.percent}% (kod ${escapeHtml(order.discount.code)})</td><td align="right" style="padding:2px 0;white-space:nowrap;">−${amount(order.discount.amount)}</td></tr>`
    : "";

  // Sve što dolazi od kupca prolazi kroz escapeHtml; gotov HTML su {{stavke}}, {{logo}},
  // {{popust}}, {{placanje}} i {{red_popusta}}.
  const values: Record<string, string> = {
    naslov: escapeHtml(title),
    poruka: escapeHtml(message),
    logo: logoSrc
      ? `<img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(store.name)}" height="56" style="height:56px;width:auto;max-width:240px;border:0;">`
      : `<span style="font-size:24px;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(store.name)}</span>`,
    naziv_sajta: escapeHtml(store.name),
    broj: escapeHtml(order.number),
    datum: escapeHtml(date),
    stavke: order.items
      .map(
        (item) =>
          `<tr><td style="padding:6px 0;">${item.qty} × ${escapeHtml(itemName(item))}</td><td align="right" style="padding:6px 0;white-space:nowrap;">${amount(item.price * item.qty)}</td></tr>`,
      )
      .join("\n"),
    medjuzbir: amount(order.subtotal),
    red_popusta: discountRow,
    popust: discountBlock,
    placanje: paymentBlock,
    naslov_popusta: escapeHtml(issued?.title ?? ""),
    kod_popusta: escapeHtml(issued?.code ?? ""),
    procenat_popusta: issued ? String(issued.percent) : "",
    dostava: amount(order.delivery),
    naslov_ukupno: totalLabel,
    ukupno: amount(order.total),
    ime: escapeHtml(customer.name),
    telefon: escapeHtml(customer.phone),
    email: escapeHtml(customer.email || "—"),
    adresa: escapeHtml(address),
    napomena: escapeHtml(customer.note || "—"),
    kontakt: escapeHtml(contact),
    boja_pozadine: colors.background,
    boja_trake: colors.surface,
    boja_teksta: colors.text,
    boja_akcenta: colors.accent,
  };
  const html = template.replace(
    /\{\{\s*([a-z_]+)\s*\}\}/g,
    (_match, key: string) => values[key] ?? "",
  );

  const text = [
    title,
    "",
    message,
    "",
    `Porudžbina br. ${order.number} · ${date}`,
    "",
    ...order.items.map((item) => `${item.qty} × ${itemName(item)} — ${amount(item.price * item.qty)}`),
    `Međuzbir: ${amount(order.subtotal)}`,
    ...(order.discount
      ? [
          `Popust ${order.discount.percent}% (kod ${order.discount.code}): −${amount(order.discount.amount)}`,
        ]
      : []),
    `${order.deliveryMethod || "Dostava"}: ${amount(order.delivery)}`,
    `${totalLabel}: ${amount(order.total)}`,
    ...(showBank
      ? ["", "Podaci za uplatu:", payment.bankInstructions, `Poziv na broj: ${order.number}`]
      : []),
    ...(issued
      ? [
          "",
          recipient === "customer"
            ? `Poklon za sledeću kupovinu — ${issued.title}: ${issued.percent}% popusta. Kod: ${issued.code} (važi za jednu kupovinu, uz isti email ili telefon).`
            : `Kupcu je poslat kod ${issued.code} za ${issued.percent}% popusta pri sledećoj kupovini.`,
        ]
      : []),
    "",
    customer.name,
    address,
    customer.phone,
    ...(customer.email ? [customer.email] : []),
    ...(customer.note ? [`Napomena: ${customer.note}`] : []),
    "",
    store.name,
    contact,
  ].join("\n");

  const subject =
    notice?.subject ??
    (recipient === "seller"
      ? `Nova porudžbina #${order.number} — ${customer.name}`
      : `Porudžbina #${order.number} je primljena — ${store.name}`);

  return { subject, html, text };
}

/** Porudžbina za pregled šablona i probni email. */
export function sampleOrder(settings: Settings): Order {
  const unit = 10 ** settings.store.currencyDecimals;
  return {
    number: "1001",
    receivedAt: new Date().toISOString(),
    status: "new",
    customerKey: "t641234567",
    customer: {
      name: "Petar Petrović",
      phone: "064 123 4567",
      email: "petar@primer.rs",
      street: "Glavna 12",
      city: "Niš",
      postalCode: "18000",
      note: "Interfon 5, posle 17 h",
    },
    items: [
      { slug: "prvi-proizvod", name: "Prvi proizvod", variant: "Plava, M", sku: "", qty: 2, price: 950 * unit, returned: 0 },
      { slug: "drugi-proizvod", name: "Drugi proizvod", variant: "", sku: "", qty: 1, price: 1050 * unit, returned: 0 },
    ],
    paymentMethod: settings.payment.bank && !settings.payment.cod ? "bank" : "cod",
    deliveryMethod: settings.shipping.methods[0]?.name ?? "Dostava",
    pickup: false,
    refunded: 0,
    taxPercent: settings.tax.enabled ? settings.tax.percent : null,
    subtotal: 2950 * unit,
    delivery: 450 * unit,
    total: 3105 * unit,
    discount: { code: "PRIMER10", percent: 10, amount: 295 * unit },
    issuedCode: { code: "HVALA15", percent: 15, title: "Hvala na porudžbini" },
  };
}

export function isMailConfigured(settings: Settings): boolean {
  return settings.mail.smtpHost !== "";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createTransport({ mail }: Settings) {
  return nodemailer.createTransport({
    host: mail.smtpHost,
    port: mail.smtpPort,
    // Port 465 šifruje vezu od početka; ostali prelaze na šifrovanu kada server to ponudi.
    secure: mail.smtpPort === 465,
    auth: mail.smtpUser ? { user: mail.smtpUser, pass: mail.smtpPassword } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/**
 * Šalje emailove o porudžbini prema podešavanjima. Vraća opis greške, ili
 * null kada je sve poslato. Proba (`test`) šalje obe varijante na adresu prodavca.
 */
async function send(order: Order, settings: Settings, test: boolean): Promise<string | null> {
  const { mail } = settings;
  const transport = createTransport(settings);

  const template = await getEmailTemplate(settings);
  const logoFile = uploadPath(settings.logo);
  const from = {
    name: mail.fromName || settings.store.name,
    address: mail.fromEmail || mail.smtpUser,
  };

  const messages: { recipient: Recipient; to: string; replyTo?: string }[] = [];
  if (test) {
    messages.push(
      { recipient: "seller", to: mail.sellerEmail },
      { recipient: "customer", to: mail.sellerEmail },
    );
  } else {
    if (mail.notifySeller && mail.sellerEmail) {
      messages.push({
        recipient: "seller",
        to: mail.sellerEmail,
        replyTo: order.customer.email || undefined,
      });
    }
    if (mail.notifyCustomer && order.customer.email) {
      messages.push({
        recipient: "customer",
        to: order.customer.email,
        replyTo: mail.sellerEmail || undefined,
      });
    }
  }

  const errors: string[] = [];
  for (const message of messages) {
    const { subject, html, text } = renderOrderEmail({
      template,
      order,
      recipient: message.recipient,
      settings,
      logoSrc: logoFile ? `cid:${LOGO_CID}` : undefined,
    });
    try {
      await transport.sendMail({
        from,
        to: message.to,
        replyTo: message.replyTo,
        subject: test ? `[Proba] ${subject}` : subject,
        html,
        text,
        // Logo ide kao prilog u poruci, pa se vidi i kada program za email blokira slike sa interneta.
        attachments: [
          ...(logoFile ? [{ filename: path.basename(logoFile), path: logoFile, cid: LOGO_CID }] : []),
          // Račun u PDF-u ide kupcu uz potvrdu porudžbine, kada je tako izabrano u Podešavanjima.
          ...(message.recipient === "customer" && !test && settings.tax.invoiceEmail === "order"
            ? [await invoiceAttachment(order, settings)]
            : []),
        ],
      });
    } catch (error) {
      errors.push(`${message.recipient === "seller" ? "prodavcu" : "kupcu"}: ${errorText(error)}`);
    }
  }
  transport.close();
  return errors.length > 0 ? errors.join(" · ") : null;
}

/** Tekst iz podešavanja sa upisanim podacima porudžbine. */
export function fillStatusText(text: string, order: Order, storeName: string, extra: Record<string, string> = {}): string {
  const tracking = order.tracking
    ? `Broj pošiljke: ${order.tracking.number}${order.tracking.url ? ` — praćenje: ${order.tracking.url}` : ""}.`
    : "";
  const values: Record<string, string> = {
    broj: order.number,
    ime: order.customer.name.split(" ")[0] ?? "",
    pracenje: tracking,
    prodavnica: storeName,
    ...extra,
  };
  return text.replace(/\{([a-z]+)\}/g, (match, key: string) => values[key] ?? match).replace(/[ \t]+$/gm, "").trim();
}

/**
 * Email kupcu o porudžbini: promena statusa ili povraćaj novca, ako je ta poruka uključena u
 * Podešavanjima. `key` je poruka koja se šalje (podrazumevano po statusu porudžbine), a `extra`
 * dodatni podaci za tekst (npr. iznos povraćaja).
 * Vraća "sent", "skipped" (nije uključena, nema emaila kupca ili email nije povezan) ili opis greške.
 */
export async function notifyStatus(
  order: Order,
  key: StatusEmailKey | undefined = STATUS_EMAILS.find((candidate) => candidate === order.status),
  extra: Record<string, string> = {},
): Promise<"sent" | "skipped" | string> {
  const settings = await getSettings();
  const config = key ? settings.mail.statusEmails[key] : undefined;
  if (!key || !config?.enabled || !order.customer.email || !isMailConfigured(settings)) return "skipped";

  const { mail, store } = settings;
  const message = fillStatusText(config.text, order, store.name, extra);
  const logoFile = uploadPath(settings.logo);
  const { subject, html, text } = renderOrderEmail({
    template: await getEmailTemplate(settings),
    order,
    recipient: "customer",
    settings,
    logoSrc: logoFile ? `cid:${LOGO_CID}` : undefined,
    notice: { subject: `${fillStatusText(config.subject, order, store.name, extra)} — ${store.name}`, title: orderStatusTitles[key], message },
  });
  const transport = createTransport(settings);
  try {
    await transport.sendMail({
      from: { name: mail.fromName || store.name, address: mail.fromEmail || mail.smtpUser },
      to: order.customer.email,
      replyTo: mail.sellerEmail || undefined,
      subject,
      html,
      text,
      attachments: [
        ...(logoFile ? [{ filename: path.basename(logoFile), path: logoFile, cid: LOGO_CID }] : []),
        // Račun ide uz poruku da je porudžbina poslata, kada je tako izabrano u Podešavanjima.
        ...(key === "shipped" && settings.tax.invoiceEmail === "shipped" ? [await invoiceAttachment(order, settings)] : []),
      ],
    });
    return "sent";
  } catch (error) {
    return errorText(error);
  } finally {
    transport.close();
  }
}

async function invoiceAttachment(order: Order, settings: Settings) {
  return { filename: invoiceFileName(order), content: await invoicePdf(order, settings), contentType: "application/pdf" };
}

const orderStatusTitles: Record<StatusEmailKey, string> = {
  confirmed: "Porudžbina je potvrđena.",
  shipped: "Porudžbina je poslata.",
  delivered: "Porudžbina je isporučena.",
  cancelled: "Porudžbina je otkazana.",
  refunded: "Povraćaj novca.",
};

export async function notifyOrder(order: Order): Promise<string | null> {
  const settings = await getSettings();
  if (!isMailConfigured(settings)) return null;
  return send(order, settings, false);
}

/** Probna poruka: obe varijante (za prodavca i za kupca) stižu na adresu prodavca. */
export async function sendTestEmail(): Promise<string | null> {
  const settings = await getSettings();
  if (!isMailConfigured(settings)) return "Upišite i sačuvajte SMTP server pre slanja probe.";
  if (!settings.mail.sellerEmail) return "Upišite i sačuvajte svoju email adresu pre slanja probe.";
  return send(sampleOrder(settings), settings, true);
}
