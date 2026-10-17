"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { addCodeTheme, deleteTheme, duplicateTheme, importTheme, MAX_THEME_ZIP, publishTheme, renameTheme } from "@/lib/theme-packages";

/** Teme u panelu (Izgled sajta → Teme): objava, dupliranje, preimenovanje, brisanje, dodavanje i ubacivanje. */

const THEMES_PATH = `${ADMIN_PATH}/izgled`;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function back(kind: "ok" | "greska", message: string): never {
  redirect(`${THEMES_PATH}?${kind}=${encodeURIComponent(message)}`);
}

function refreshSite() {
  revalidatePath("/", "layout");
}

export async function publishThemeAction(formData: FormData) {
  await requireAdmin("content");
  if (!(await publishTheme(text(formData, "id")))) back("greska", "Tema ne postoji ili je već aktivna.");
  refreshSite();
  await audit("Objavljena tema", text(formData, "name"));
  back("ok", "Tema je objavljena. Sajt sada izgleda ovako.");
}

export async function duplicateThemeAction(formData: FormData) {
  await requireAdmin("content");
  const copy = await duplicateTheme(text(formData, "id"));
  if (!copy) back("greska", "Tema ne postoji.");
  await audit("Duplirana tema", copy.name);
  back("ok", "Napravljena je kopija teme.");
}

export async function renameThemeAction(formData: FormData) {
  await requireAdmin("content");
  if (!(await renameTheme(text(formData, "id"), text(formData, "name")))) back("greska", "Upišite naziv teme.");
  await audit("Preimenovana tema", text(formData, "name"));
  back("ok", "Naziv teme je sačuvan.");
}

export async function deleteThemeAction(formData: FormData) {
  await requireAdmin("content");
  if (!(await deleteTheme(text(formData, "id")))) back("greska", "Aktivna tema i jedina tema ne mogu da se obrišu.");
  await audit("Obrisana tema", text(formData, "name"));
  back("ok", "Tema je obrisana.");
}

export async function addCodeThemeAction(formData: FormData) {
  await requireAdmin("content");
  const theme = await addCodeTheme(text(formData, "base"));
  if (!theme) back("greska", "Ta tema iz koda nije instalirana.");
  await audit("Dodata tema", theme.name);
  back("ok", "Tema je dodata u biblioteku. Pregledajte je pa objavite kada budete spremni.");
}

export async function importThemeAction(formData: FormData) {
  await requireAdmin("content");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) back("greska", "Izaberite .zip fajl teme.");
  if (file.size > MAX_THEME_ZIP) back("greska", "Tema je veća od 15 MB.");
  const result = await importTheme(new Uint8Array(await file.arrayBuffer()), file.name);
  if (!result.ok) back("greska", result.error);
  await audit("Ubačena tema", result.theme.name);
  back("ok", ["Tema je ubačena u biblioteku. Pregledajte je pa objavite kada budete spremni.", ...result.notes].join(" "));
}
