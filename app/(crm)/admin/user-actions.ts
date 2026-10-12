"use server";

import { redirect } from "next/navigation";
import {
  ADMIN_PATH,
  beginTotp,
  checkAdminPassword,
  createAdmin,
  deleteAdmin,
  disableTotp,
  enableTotp,
  isValidUsername,
  PASSWORD_MIN,
  requireAdmin,
  roleLabels,
  setAdminPassword,
  updateAdmin,
  type Role,
} from "@/lib/admin-auth";
import { audit } from "@/lib/audit";

/** Korisnici panela (samo vlasnik) i sopstveni nalog: lozinka i prijava u dva koraka. */

const USERS_PATH = `${ADMIN_PATH}/korisnici`;
const ACCOUNT_PATH = `${ADMIN_PATH}/nalog`;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function back(path: string, kind: "greska" | "ok", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

function role(formData: FormData): Role {
  const value = text(formData, "role");
  return value in roleLabels ? (value as Role) : "sales";
}

function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Lozinka mora imati najmanje ${PASSWORD_MIN} znakova.`;
  if (password.length > 200) return "Lozinka je predugačka.";
  return null;
}

/* ---------- Korisnici ---------- */

export async function createUserAction(formData: FormData) {
  await requireAdmin("users");
  const username = text(formData, "username").toLowerCase();
  const name = text(formData, "name").slice(0, 100);
  // Lozinka se ne skraćuje i ne sređuje: uzima se tačno kako je upisana.
  const password = String(formData.get("password") ?? "");
  if (!isValidUsername(username)) back(USERS_PATH, "greska", "Korisničko ime: 3–100 znakova, mala slova, cifre, tačka, crtica ili email adresa.");
  if (!name) back(USERS_PATH, "greska", "Upišite ime korisnika.");
  const problem = passwordProblem(password);
  if (problem) back(USERS_PATH, "greska", problem);

  const user = await createAdmin({ username, name, password, role: role(formData) });
  if (!user) back(USERS_PATH, "greska", "Korisnik sa tim imenom već postoji.");
  await audit("Dodat korisnik panela", `${user.username} (${roleLabels[user.role]})`);
  back(USERS_PATH, "ok", `Korisnik ${user.username} je dodat. Lozinku mu javite sami; može da je promeni u svom nalogu.`);
}

export async function updateUserAction(formData: FormData) {
  const current = await requireAdmin("users");
  const id = Number(text(formData, "id"));
  const name = text(formData, "name").slice(0, 100);
  if (!name) back(USERS_PATH, "greska", "Upišite ime korisnika.");
  const disabled = formData.get("disabled") === "on";
  if (id === current.id && disabled) back(USERS_PATH, "greska", "Ne možete isključiti sopstveni nalog.");

  const result = await updateAdmin(id, { name, role: role(formData), disabled });
  if (result === "last-owner") back(USERS_PATH, "greska", "Mora ostati bar jedan aktivan vlasnik.");
  await audit("Izmenjen korisnik panela", `${name} (${roleLabels[role(formData)]}${disabled ? ", isključen" : ""})`);
  back(USERS_PATH, "ok", "Korisnik je sačuvan.");
}

/** Vlasnik postavlja novu lozinku drugom korisniku (npr. kada je zaboravi). */
export async function resetUserPasswordAction(formData: FormData) {
  await requireAdmin("users");
  const id = Number(text(formData, "id"));
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) back(USERS_PATH, "greska", problem);
  await setAdminPassword(id, password);
  await audit("Postavljena nova lozinka korisniku panela", text(formData, "username"));
  back(USERS_PATH, "ok", "Lozinka je promenjena. Korisnik je odjavljen sa svih uređaja.");
}

/** Vlasnik isključuje prijavu u dva koraka korisniku koji je ostao bez telefona i rezervnih kodova. */
export async function resetUserTotpAction(formData: FormData) {
  await requireAdmin("users");
  await disableTotp(Number(text(formData, "id")));
  await audit("Isključena prijava u dva koraka korisniku panela", text(formData, "username"));
  back(USERS_PATH, "ok", "Prijava u dva koraka je isključena za tog korisnika.");
}

export async function deleteUserAction(formData: FormData) {
  const current = await requireAdmin("users");
  const id = Number(text(formData, "id"));
  if (id === current.id) back(USERS_PATH, "greska", "Ne možete obrisati sopstveni nalog.");
  const result = await deleteAdmin(id);
  if (result === "last-owner") back(USERS_PATH, "greska", "Mora ostati bar jedan aktivan vlasnik.");
  await audit("Obrisan korisnik panela", text(formData, "username"));
  back(USERS_PATH, "ok", "Korisnik je obrisan.");
}

/* ---------- Moj nalog ---------- */

export async function changePasswordAction(formData: FormData) {
  const user = await requireAdmin();
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!(await checkAdminPassword(user.id, current))) back(ACCOUNT_PATH, "greska", "Trenutna lozinka nije ispravna.");
  const problem = passwordProblem(password);
  if (problem) back(ACCOUNT_PATH, "greska", problem);
  // Ostaje prijavljen na ovom uređaju; ostali se odjavljuju.
  await setAdminPassword(user.id, password, true);
  await audit("Promenjena sopstvena lozinka");
  back(ACCOUNT_PATH, "ok", "Lozinka je promenjena. Odjavljeni ste sa ostalih uređaja.");
}

/** Prvi korak podešavanja: pravi tajnu koju korisnik skenira aplikacijom. */
export async function startTotpAction() {
  const user = await requireAdmin();
  if (user.totpEnabled) back(ACCOUNT_PATH, "greska", "Prijava u dva koraka je već uključena.");
  await beginTotp(user.id);
  redirect(`${ACCOUNT_PATH}?korak=kod`);
}

export type TotpState = { error?: string; codes?: string[] };

/** Drugi korak: kod iz aplikacije potvrđuje da je skenirana, i tek tada se prijava u dva koraka uključuje. */
export async function confirmTotpAction(_previous: TotpState, formData: FormData): Promise<TotpState> {
  const user = await requireAdmin();
  const codes = await enableTotp(user.id, text(formData, "code"));
  if (!codes) return { error: "Kod nije ispravan. Upišite kod koji aplikacija trenutno prikazuje." };
  await audit("Uključena prijava u dva koraka");
  return { codes };
}

export async function disableTotpAction(formData: FormData) {
  const user = await requireAdmin();
  if (!(await checkAdminPassword(user.id, String(formData.get("current") ?? "")))) {
    back(ACCOUNT_PATH, "greska", "Lozinka nije ispravna.");
  }
  await disableTotp(user.id);
  await audit("Isključena prijava u dva koraka");
  back(ACCOUNT_PATH, "ok", "Prijava u dva koraka je isključena.");
}
