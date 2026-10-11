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

/**
 * Čita CSV: polja pod navodnicima mogu da sadrže razdelnik, prelom reda i udvojen navodnik.
 * Razdelnik (zarez ili tačka-zarez) se prepoznaje iz prvog reda. Prazni redovi se preskaču.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

/** Redovi kao objekti po nazivu kolone iz zaglavlja; nazivi se porede bez razlike u velikim slovima. */
export function csvRecords(rows: string[][]): Record<string, string>[] {
  const [header = [], ...body] = rows;
  const names = header.map((name) => name.trim().toLowerCase());
  return body.map((cells) =>
    Object.fromEntries(names.map((name, index) => [name, (cells[index] ?? "").trim()])),
  );
}
