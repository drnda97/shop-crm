import sharp from "sharp";
import { FULL_WIDTH, IMAGE_WIDTHS } from "./media.ts";

/**
 * Obrada slike pri ubacivanju: WebP u više širina (lib/media.ts). Samo za server.
 * Uvoz je sa nastavkom .ts i bez prečice „@/", da isti fajl koriste i skripte u scripts/.
 */

export type ImageKind = "jpg" | "png" | "webp" | "svg";

/** Tip se čita iz sadržaja fajla, ne iz imena ni iz onoga što javi pregledač. */
export function detectImage(bytes: Buffer): ImageKind | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  // SVG je tekst: posle zaglavlja i komentara mora da počne oznakom <svg.
  const head = bytes.subarray(0, 2048).toString("utf8").replace(/^﻿/, "");
  const start = head.replace(/<\?xml[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/gi, "").trimStart();
  if (/^<svg[\s>]/i.test(start)) return "svg";
  return null;
}

export type ImageFile = { name: string; data: Buffer };

/**
 * Fotografija → WebP u svim širinama. Prvi fajl je najveća veličina („-full"), čija se putanja
 * čuva u sadržaju. Slika uža od neke širine se ne uvećava: ta veličina ostaje u izvornoj širini.
 */
export async function makeSizes(bytes: Buffer, base: string): Promise<ImageFile[]> {
  // rotate() bez argumenta ispravlja sliku prema zapisu iz telefona (EXIF), koji se zatim odbacuje.
  const source = sharp(bytes, { failOn: "error" }).rotate();
  const resize = (width: number, quality: number) =>
    source.clone().resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();

  const files: ImageFile[] = [{ name: `${base}-full.webp`, data: await resize(FULL_WIDTH, 82) }];
  for (const width of IMAGE_WIDTHS) {
    files.push({ name: `${base}-w${width}.webp`, data: await resize(width, 78) });
  }
  return files;
}
