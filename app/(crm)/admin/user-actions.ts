"use server";

import { isLang } from "@/lib/i18n";
import { translateContent } from "@/lib/i18n/content";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_PATH,
  beginTotp,
  checkAdminPassword,
  createAdmin,
  createAdminReset,
  createFirstOwner,
  createSession,
  deleteAdmin,
  disableTotp,
  enableTotp,
  isValidUsername,
  needsSetup,
  PASSWORD_MIN,
  requireAdmin,
  resetAdminPassword,
  roleLabels,
  setAdminEmail,
  setAdminPassword,
  updateAdmin,
  type Role,
} from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { getSettings, updateContent } from "@/lib/content";
import { getPanelT } from "@/lib/i18n/server";
import { isMailReady, linkBase, NO_SITE_URL, sendMails, simpleEmail } from "@/lib/mail";
import {
  createApiKey,
  createWebhook,
  deleteApiKey,
  deleteWebhook,
  deliverWebhook,
  isWebhookUrl,
  listWebhooks,
  setWebhookActive,
  webhookEvents,
  type WebhookEvent,
} from "@/lib/integrations";
import { clientIp, TOO_MANY, tooMany } from "@/lib/rate-limit";

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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adresa korisnika panela: prazna, ispravna, ili null kada nije ispravna. */
function userEmail(formData: FormData): string | null {
  const value = text(formData, "email").toLowerCase().slice(0, 191);
  return value === "" || EMAIL_PATTERN.test(value) ? value : null;
}

/* ---------- Zaboravljena lozinka ---------- */

export type ForgotState = { error?: string; sent?: boolean };

/** Šalje link za novu lozinku. Odgovor je isti i kada korisnika nema, da forma ne otkriva ko postoji. */
export async function forgotPasswordAction(_previous: ForgotState, formData: FormData): Promise<ForgotState> {
  const requestHeaders = await headers();
  if (tooMany("admin-forgot", clientIp(requestHeaders), 5)) return { error: TOO_MANY };
  const login = text(formData, "login").toLowerCase().slice(0, 191);
  if (!login) return { error: "Upišite korisničko ime ili email adresu." };
  const settings = await getSettings();
  if (!isMailReady(settings)) {
    return { error: "Slanje emaila nije podešeno, pa link ne može da stigne. Novu lozinku vam postavlja vlasnik, a vlasniku komanda npm run admin:user." };
  }
  const base = linkBase(settings, requestHeaders);
  if (!base) return { error: NO_SITE_URL };
  // Uz brojač po adresi i jedan po nalogu: adresu posetilac može da menja.
  if (tooMany("admin-forgot-user", login, 3)) return { sent: true };
  const reset = await createAdminReset(login);
  if (reset) {
    const t = await getPanelT();
    const { errors } = await sendMails(settings, [
      {
        to: reset.user.email,
        subject: `${t("Nova lozinka za panel")} — ${settings.store.name}`,
        ...simpleEmail(settings, {
          message: t("Zdravo {ime}, tražili ste novu lozinku za panel prodavnice. Link važi jedan sat.\n\nAko to niste bili vi, ne morate ništa da radite: lozinka ostaje ista.", { ime: reset.user.name }),
          button: { label: t("Postavite novu lozinku"), url: `${base}/admin-lozinka/${reset.token}` },
        }),
      },
    ]);
    if (errors.length > 0) console.error(`[nova lozinka panela] ${errors[0]}`);
    await audit("Poslat link za novu lozinku", reset.user.username, reset.user);
  }
  return { sent: true };
}

export type NewPasswordState = { error?: string; done?: boolean };

export async function newPasswordAction(_previous: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  if (tooMany("admin-reset", clientIp(await headers()), 10)) return { error: TOO_MANY };
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(formData.get("repeat") ?? "")) return { error: "Lozinke se ne poklapaju." };
  const user = await resetAdminPassword(text(formData, "token"), password);
  if (!user) return { error: "Link više ne važi. Zatražite novi." };
  await audit("Postavljena nova lozinka preko linka", user.username, user);
  return { done: true };
}

/* ---------- Prvo pokretanje ---------- */

export type SetupState = { error?: string };

/** Pravi nalog vlasnika i upisuje naziv prodavnice; radi samo dok u panelu nema nijednog korisnika. */
export async function setupAction(_previous: SetupState, formData: FormData): Promise<SetupState> {
  if (tooMany("admin-setup", clientIp(await headers()), 10)) return { error: TOO_MANY };
  if (!(await needsSetup())) return { error: "Panel je već podešen. Osvežite stranicu i prijavite se." };
  const username = text(formData, "username").toLowerCase();
  const name = text(formData, "name").slice(0, 100);
  const store = text(formData, "store").slice(0, 100);
  const email = text(formData, "email").slice(0, 200);
  const password = String(formData.get("password") ?? "");
  if (!name) return { error: "Upišite svoje ime." };
  if (!isValidUsername(username)) return { error: "Korisničko ime: 3–100 znakova, mala slova, cifre, tačka, crtica ili email adresa." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(formData.get("repeat") ?? "")) return { error: "Lozinke se ne poklapaju." };

  const user = await createFirstOwner({ username, name, email: EMAIL_PATTERN.test(email) ? email.toLowerCase().slice(0, 191) : "", password });
  if (!user) return { error: "Panel je već podešen. Osvežite stranicu i prijavite se." };
  const language = formData.get("language");
  await updateContent((content) => {
    if (isLang(language)) {
      // Izabrani jezik važi za sajt i za panel; početni sadržaj prelazi na njega.
      translateContent(content, content.settings.store.language, language);
      content.settings.store.language = language;
      content.settings.store.panelLanguage = language;
    }
    if (store) content.settings.store.name = store;
    if (email) content.settings.store.email = email;
  });
  await createSession(user.id);
  await audit("Prvo pokretanje: napravljen vlasnik", user.username, user);
  redirect(`${ADMIN_PATH}/podesavanja`);
}

/* ---------- Veza sa spoljnim sistemima ---------- */

const INTEGRATIONS_PATH = `${ADMIN_PATH}/integracije`;

/** Šta je spolja dostupno. Sve je isključeno dok vlasnik ne uključi. */
export async function saveAccessAction(formData: FormData) {
  await requireAdmin("settings");
  const access = {
    publicApi: formData.get("publicApi") === "on",
    adminApi: formData.get("adminApi") === "on",
    webhooks: formData.get("webhooks") === "on",
  };
  await updateContent((content) => {
    content.settings.access = access;
  });
  const on = [access.publicApi ? "javni API" : "", access.adminApi ? "API sa ključem" : "", access.webhooks ? "webhook-ovi" : ""].filter(Boolean);
  await audit("Promenjen pristup spolja", on.length > 0 ? `uključeno: ${on.join(", ")}` : "sve isključeno");
  back(INTEGRATIONS_PATH, "ok", "Pristup spolja je sačuvan.");
}

export type ApiKeyState = { error?: string; key?: string };

/** Ceo ključ se vraća formi i vidi samo jednom; u bazi ostaje heš. */
export async function createApiKeyAction(_previous: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  await requireAdmin("settings");
  const name = text(formData, "name").slice(0, 100);
  if (!name) return { error: "Upišite čemu ključ služi, npr. „Knjigovodstvo“." };
  const key = await createApiKey(name, text(formData, "scope") === "write" ? "write" : "read");
  await audit("Napravljen API ključ", name);
  return { key };
}

export async function deleteApiKeyAction(formData: FormData) {
  await requireAdmin("settings");
  await deleteApiKey(Number(text(formData, "id")));
  await audit("Obrisan API ključ", formData);
  back(INTEGRATIONS_PATH, "ok", "Ključ je obrisan i više ne važi.");
}

export async function createWebhookAction(formData: FormData) {
  await requireAdmin("settings");
  const url = text(formData, "url");
  if (!isWebhookUrl(url)) back(INTEGRATIONS_PATH, "greska", "Adresa počinje sa https:// ili http:// i ima najviše 500 znakova.");
  const events = formData.getAll("events").filter((event): event is WebhookEvent => typeof event === "string" && event in webhookEvents);
  if (events.length === 0) back(INTEGRATIONS_PATH, "greska", "Izaberite bar jedan događaj.");
  await createWebhook(url, events);
  await audit("Dodat webhook", url);
  back(INTEGRATIONS_PATH, "ok", "Webhook je dodat. Pošaljite probu da proverite da adresa odgovara.");
}

export async function toggleWebhookAction(formData: FormData) {
  await requireAdmin("settings");
  await setWebhookActive(Number(text(formData, "id")), text(formData, "active") === "1");
  await audit(text(formData, "active") === "1" ? "Uključen webhook" : "Isključen webhook", text(formData, "url"));
  redirect(INTEGRATIONS_PATH);
}

export async function deleteWebhookAction(formData: FormData) {
  await requireAdmin("settings");
  await deleteWebhook(Number(text(formData, "id")));
  await audit("Obrisan webhook", text(formData, "url"));
  back(INTEGRATIONS_PATH, "ok", "Webhook je obrisan.");
}

/** Šalje probnu poruku (događaj `ping`), jednom i bez ponavljanja, i javlja šta je adresa odgovorila. */
export async function testWebhookAction(formData: FormData) {
  await requireAdmin("settings");
  const id = Number(text(formData, "id"));
  const webhook = (await listWebhooks()).find((hook) => hook.id === id);
  if (!webhook) redirect(INTEGRATIONS_PATH);
  const outcome = await deliverWebhook(webhook, "ping", { message: "Proba iz panela" }, []);
  if (outcome.error) back(INTEGRATIONS_PATH, "greska", `Proba nije uspela: ${outcome.error}`);
  back(INTEGRATIONS_PATH, "ok", `Proba je stigla (odgovor ${outcome.status}).`);
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
  const email = userEmail(formData);
  if (email === null) back(USERS_PATH, "greska", "Email adresa nije ispravna.");

  const user = await createAdmin({ username, name, email, password, role: role(formData) });
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
  const email = userEmail(formData);
  if (email === null) back(USERS_PATH, "greska", "Email adresa nije ispravna.");

  const result = await updateAdmin(id, { name, email, role: role(formData), disabled });
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

export async function saveEmailAction(formData: FormData) {
  const user = await requireAdmin();
  const email = userEmail(formData);
  if (email === null) back(ACCOUNT_PATH, "greska", "Email adresa nije ispravna.");
  await setAdminEmail(user.id, email);
  await audit("Promenjena sopstvena email adresa");
  back(ACCOUNT_PATH, "ok", email ? "Email adresa je sačuvana. Na nju stiže link ako zaboravite lozinku." : "Email adresa je uklonjena.");
}

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
