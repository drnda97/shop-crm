import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/**
 * Excel (.xlsx) bez posebne biblioteke za Excel: fajl je zip sa XML-om, a ovde se čita i piše
 * samo ono što treba za tabele (tekst i brojevi po ćelijama, više listova). Formule, stilovi
 * i spojene ćelije se pri čitanju zanemaruju; vrednost formule se čita iz poslednjeg računanja.
 */

const decode = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");

const encode = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Kontrolni znaci (osim taba i prelaza u nov red) nisu dozvoljeni u XML-u.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

/** Tekst svih <t> u delu XML-a (ćelija sa bogatim tekstom ima više delova). */
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map((match) => decode(match[1] ?? "")).join("");

/** „AB12" → 27 (kolona od nule). */
function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** Da li bajtovi izgledaju kao zip (xlsx), a ne kao tekst (csv). */
export function isXlsx(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Prvi list fajla kao redovi ćelija (tekst). Prazni redovi se preskaču. Neispravan fajl: null. */
export function readXlsx(bytes: Uint8Array): string[][] | null {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return null;
  }
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : "");
  const workbook = read("xl/workbook.xml");
  const firstSheet = workbook.match(/<sheet\s[^>]*r:id="([^"]+)"/)?.[1];
  const rels = read("xl/_rels/workbook.xml.rels");
  const target = [...rels.matchAll(/<Relationship\s[^>]*>/g)]
    .map((match) => match[0])
    .find((tag) => firstSheet && tag.includes(`Id="${firstSheet}"`))
    ?.match(/Target="([^"]+)"/)?.[1];
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`) : "xl/worksheets/sheet1.xml";
  const sheet = read(sheetPath) || read("xl/worksheets/sheet1.xml");
  if (!sheet) return null;

  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => texts(match[1]));
  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1];
      const inner = cell[2] ?? "";
      const reference = attributes.match(/\br="([A-Z]+)\d*"/i)?.[1];
      const type = attributes.match(/\bt="([^"]+)"/)?.[1] ?? "n";
      const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = texts(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "");
      else if (type === "b") value = raw === "1" ? "da" : "ne";
      else if (raw !== undefined) value = decode(raw);
      // Broj koji Excel čuva sa greškom zaokruživanja (39900.000000000004) vraća se na kraći zapis.
      if (type === "n" && value !== "" && Number.isFinite(Number(value))) value = String(Number(Number(value).toPrecision(15)));
      const index = reference ? columnIndex(reference) : row.length;
      while (row.length < index) row.push("");
      row[index] = value;
    }
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  return rows;
}

export type XlsxSheet = {
  name: string;
  rows: (string | number)[][];
  /** Širina kolona u znakovima, redom. */
  widths?: number[];
  /** Prvi red je zaglavlje: podebljan i zamrznut pri pomeranju. */
  header?: boolean;
};

/** Pravi .xlsx sa datim listovima. Tekst ostaje tekst (i kada liči na formulu), broj ostaje broj. */
export function writeXlsx(sheets: XlsxSheet[]): Uint8Array {
  const sheetXml = ({ rows, widths, header }: XlsxSheet) => {
    const cols = widths?.length
      ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`
      : "";
    const pane = header ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : "";
    const body = rows
      .map((row, rowIndex) => {
        const cells = row
          .map((value, columnIndexValue) => {
            const reference = `${columnName(columnIndexValue)}${rowIndex + 1}`;
            const style = header && rowIndex === 0 ? ' s="1"' : ' s="2"';
            if (typeof value === "number") return `<c r="${reference}"${style}><v>${value}</v></c>`;
            if (value === "") return "";
            return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${encode(value)}</t></is></c>`;
          })
          .join("");
        return `<row r="${rowIndex + 1}">${cells}</row>`;
      })
      .join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${body}</sheetData></worksheet>`;
  };

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
        .map((sheet, index) => `<sheet name="${encode(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    // Stil 1: podebljano zaglavlje sa pozadinom; stil 2: tekst sa prelomom, poravnat gore.
    "xl/styles.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F3F0"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ),
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(sheet));
  });
  return zipSync(files);
}

export function xlsxResponse(fileName: string, sheets: XlsxSheet[]): Response {
  return new Response(Buffer.from(writeXlsx(sheets)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
