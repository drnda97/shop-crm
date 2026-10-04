/**
 * CSV za Excel: polja razdvojena tačka-zarezom (tako ga Excel na našim
 * podešavanjima otvara u kolonama) i BOM na početku, da se č, ć, š, ž i đ vide ispravno.
 */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${rows.map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}

export function csvResponse(fileName: string, rows: (string | number)[][]): Response {
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
