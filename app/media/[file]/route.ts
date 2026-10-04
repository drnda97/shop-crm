import { readFile } from "node:fs/promises";
import path from "node:path";
import { MEDIA_FILE_PATTERN, UPLOADS_DIR } from "@/lib/content";

const contentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Služi slike ubačene iz admin panela (storage/uploads). */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // Ime mora da odgovara obrascu koji pravi saveUpload — bez kosih crta i tačaka u putanji.
  if (!MEDIA_FILE_PATTERN.test(file)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bytes = await readFile(path.join(UPLOADS_DIR, file));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentTypes[file.split(".").pop()!],
        // Svaka ubačena slika ima svoje ime, pa sadržaj pod jednim imenom nikad ne menja.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        // Slike se prikazuju na sajtu prodavnice, koji je na drugoj adresi.
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
