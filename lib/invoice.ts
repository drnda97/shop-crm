import path from "node:path";
import PDFDocument from "pdfkit";
import { discountText } from "@/lib/discounts";
import { formatMoney } from "@/lib/format";
import { includedTax, itemName, type Order } from "@/lib/orders";
import { currencyOf, paymentLabels, type Settings } from "@/lib/settings";

/**
 * Račun porudžbine u PDF-u: preuzima se iz panela i iz naloga kupca, i ide kupcu u prilogu
 * emaila (Podešavanja → Račun i PDV). Nije fiskalni račun. Samo za server.
 */

// Font sa našim slovima (č, ć, đ); ugrađeni PDF fontovi ih nemaju.
const FONTS = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");

export function invoiceFileName(order: Order): string {
  return `racun-${order.number}.pdf`;
}

export function invoicePdf(order: Order, settings: Settings): Promise<Buffer> {
  const { store, tax } = settings;
  const currency = currencyOf(settings);
  const money = (value: number) => formatMoney(value, currency);
  const date = new Intl.DateTimeFormat(store.locale, { dateStyle: "long", timeZone: store.timeZone }).format(
    new Date(order.receivedAt),
  );
  // Stopa upisana uz porudžbinu važi i kada se podešavanje kasnije promeni.
  const percent = order.taxPercent ?? (tax.enabled ? tax.percent : null);
  const vat = percent === null ? null : includedTax(order.total, percent);

  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Račun ${order.number}`, Author: store.name } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.registerFont("regular", path.join(FONTS, "DejaVuSans.ttf"));
  doc.registerFont("bold", path.join(FONTS, "DejaVuSans-Bold.ttf"));
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const gray = "#555555";

  // Zaglavlje
  doc.font("bold").fontSize(20).fillColor("#111111").text(`Račun br. ${order.number}`, left, 48);
  doc.font("regular").fontSize(10).fillColor(gray).text(`Datum: ${date}`);
  doc.font("bold").fontSize(13).fillColor("#111111").text(store.name, left, 52, { width, align: "right" });

  // Prodavac i kupac
  const top = 118;
  const half = width / 2 - 12;
  const party = (title: string, lines: string[], x: number) => {
    doc.font("regular").fontSize(8).fillColor(gray).text(title.toUpperCase(), x, top, { characterSpacing: 1 });
    doc.font("regular").fontSize(10).fillColor("#111111").text(lines.filter(Boolean).join("\n"), x, top + 14, { width: half, lineGap: 2 });
    return doc.y;
  };
  const sellerEnd = party("Prodavac", store.legal ? store.legal.split("\n") : [store.name, store.address, store.phone, store.email], left);
  const { customer } = order;
  const buyerEnd = party("Kupac", [customer.name, customer.street, `${customer.postalCode} ${customer.city}`, customer.phone, customer.email], left + half + 24);

  // Stavke
  const columns = { qty: left + width - 230, price: left + width - 160, total: left + width - 80 };
  let y = Math.max(sellerEnd, buyerEnd) + 28;
  const head = (label: string, x: number, w: number, align: "left" | "right" = "right") =>
    doc.font("regular").fontSize(8).fillColor(gray).text(label.toUpperCase(), x, y, { width: w, align, characterSpacing: 0.8 });
  head("Stavka", left, columns.qty - left - 8, "left");
  head("Količina", columns.qty, 60);
  head("Cena", columns.price, 70);
  head("Iznos", columns.total, 80);
  y += 14;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1.2).strokeColor("#111111").stroke();
  y += 8;

  for (const item of order.items) {
    const name = item.sku ? `${itemName(item)}\n${item.sku}` : itemName(item);
    const height = doc.font("regular").fontSize(10).heightOfString(name, { width: columns.qty - left - 8 });
    // Stavka koja ne staje prelazi na novu stranu cela.
    if (y + height > doc.page.height - 190) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.fillColor("#111111").text(name, left, y, { width: columns.qty - left - 8 });
    doc.text(String(item.qty), columns.qty, y, { width: 60, align: "right" });
    doc.text(money(item.price), columns.price, y, { width: 70, align: "right" });
    doc.text(money(item.price * item.qty), columns.total, y, { width: 80, align: "right" });
    y += height + 7;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor("#dddddd").stroke();
    y += 7;
  }

  // Zbir
  const sums: [string, string, boolean?][] = [
    ["Međuzbir", money(order.subtotal)],
    ...(order.discount ? ([[discountText(order.discount), `−${money(order.discount.amount)}`]] as [string, string][]) : []),
    [order.deliveryMethod || "Dostava", money(order.delivery)],
    ...(vat === null ? [] : ([["Osnovica", money(order.total - vat)], [`PDV ${percent}%`, money(vat)]] as [string, string][])),
    ["Ukupno", money(order.total), true],
    ...(order.refunded > 0 ? ([["Vraćeno kupcu", `−${money(order.refunded)}`]] as [string, string][]) : []),
  ];
  const sumLeft = right - 330;
  const labelWidth = 220;
  y += 6;
  for (const [label, value, strong] of sums) {
    if (strong) {
      doc.moveTo(sumLeft, y).lineTo(right, y).lineWidth(1.2).strokeColor("#111111").stroke();
      y += 8;
    }
    doc.font(strong ? "bold" : "regular").fontSize(strong ? 12 : 10).fillColor("#111111");
    // Dug naziv (način dostave, kod popusta) prelazi u drugi red; sledeći red zbira ide ispod njega.
    const height = doc.heightOfString(label, { width: labelWidth });
    doc.text(label, sumLeft, y, { width: labelWidth });
    doc.text(value, sumLeft + labelWidth, y, { width: right - sumLeft - labelWidth, align: "right" });
    y += height + (strong ? 8 : 5);
  }

  doc.font("regular").fontSize(9).fillColor(gray).text(
    `Način plaćanja: ${paymentLabels[order.paymentMethod].toLowerCase()}${order.paidAt ? " · plaćeno" : ""}. ${
      vat === null ? "Prodavac nije u sistemu PDV-a." : "Cene sadrže PDV."
    }`,
    left,
    y + 18,
    { width },
  );

  doc.end();
  return done;
}
