import { headers } from "next/headers";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { templatePlaceholders } from "@/lib/email-template";
import { fromMinor } from "@/lib/format";
import {
  resetTemplateAction,
  saveAppearanceAction,
  saveMailAction,
  savePaymentAction,
  saveShippingAction,
  saveStoreAction,
  sendTestEmailAction,
  uploadTemplateAction,
} from "../actions";
import {
  buttonClass,
  cardClass,
  Checkbox,
  fileClass,
  IMAGE_ACCEPT,
  inputClass,
  labelClass,
  PageHeader,
  quietButtonClass,
  Thumb,
  textLinkClass,
} from "../ui";

type SettingsPageProps = {
  searchParams: Promise<{ greska?: string; ok?: string }>;
};

const sectionClass = cardClass;
const columnClass = "flex min-w-0 flex-col gap-[16px]";
const sectionTitle = "text-[22px]";
const sectionHint = "mb-[16px] text-[14px] text-muted";
const groupTitle = "mt-[10px] text-[16px]";
const twoColumns = "grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-[16px]";
const checkboxLabel = "flex cursor-pointer items-start gap-[10px] text-[15px] leading-[22px]";
const codeClass = "rounded-[14px] bg-band px-[14px] py-[12px] font-mono text-[13px] break-all";

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  await requireAdmin();
  const { greska, ok } = await searchParams;
  // Lozinka za SMTP se namerno ne šalje u formu.
  const { store, logo, favicon, mail, shipping, payment } = await getSettings();
  const previewPath = `${ADMIN_PATH}/podesavanja/pregled`;
  const decimals = store.currencyDecimals;
  const priceStep = decimals === 0 ? "1" : "0.01";

  // Adresa ovog CRM-a, za primer povezivanja sajta.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const crmUrl = process.env.PUBLIC_URL?.replace(/\/+$/, "") ?? `${protocol}://${host}`;

  return (
    <>
      <PageHeader title="Opšta podešavanja" error={greska} notice={ok} />

      {/* Na širokom ekranu dve kolone; na užem se sekcije ređaju jedna ispod druge. */}
      <div className="grid items-start gap-[16px] xl:grid-cols-2">
        <div className={columnClass}>
          <section className={sectionClass}>
            <h2 className={sectionTitle}>Prodavnica</h2>
            <p className={sectionHint}>
              Naziv i kontakt idu u email kupcu i preko API-ja na sajt. Valuta važi za sve cene.
            </p>
            <form action={saveStoreAction} className="flex flex-col gap-[16px]">
              <div className={twoColumns}>
                <label className={labelClass}>
                  Naziv prodavnice *
                  <input name="name" required defaultValue={store.name} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Telefon
                  <input name="phone" defaultValue={store.phone} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Email prodavnice
                  <input
                    name="email"
                    type="email"
                    defaultValue={store.email}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Adresa
                  <input name="address" defaultValue={store.address} className={inputClass} />
                </label>
              </div>

              <h3 className={groupTitle}>Valuta i zemlja</h3>
              <div className={twoColumns}>
                <label className={labelClass}>
                  Oznaka valute *
                  <input
                    name="currency"
                    required
                    maxLength={8}
                    defaultValue={store.currency}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Zapis iznosa
                  <select
                    name="currencyDecimals"
                    defaultValue={String(decimals)}
                    className={inputClass}
                  >
                    <option value="0">Celi iznosi (1.250 RSD)</option>
                    <option value="2">Sa dve decimale (12,50 €)</option>
                  </select>
                </label>
                <label className={labelClass}>
                  Pozivni broj zemlje (bez plusa)
                  <input
                    name="phonePrefix"
                    defaultValue={store.phonePrefix}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Početak nasumičnih kodova za popust
                  <input
                    name="codePrefix"
                    maxLength={12}
                    defaultValue={store.codePrefix}
                    className={`${inputClass} uppercase`}
                  />
                </label>
                <label className={labelClass}>
                  Jezik datuma
                  <input name="locale" defaultValue={store.locale} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Vremenska zona
                  <input name="timeZone" defaultValue={store.timeZone} className={inputClass} />
                </label>
              </div>
              <p className="mt-[-8px] text-[14px] text-muted">
                Zapis iznosa izaberite pre unosa proizvoda: ako ga promenite kasnije, već upisane
                cene se čitaju sto puta veće ili manje. Po pozivnom broju se isti kupac prepoznaje i
                kada jednom upiše 064…, a drugi put +38164…
              </p>

              <h3 className={groupTitle}>Sajt prodavnice</h3>
              <label className={labelClass}>
                Adresa sajta (link „Otvori sajt“ u meniju)
                <input
                  name="storefrontUrl"
                  type="url"
                  defaultValue={store.storefrontUrl}
                  placeholder="https://mojsajt.rs"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Sajtovi koji smeju da zovu API iz pregledača — jedan po redu, npr.
                https://mojsajt.rs
                <textarea
                  name="allowedOrigins"
                  defaultValue={store.allowedOrigins}
                  className={`${inputClass} min-h-[80px] font-mono text-[14px]`}
                />
              </label>
              <p className="mt-[-8px] text-[14px] text-muted">
                Dok je polje prazno, API može da zove bilo koji sajt. Kada sajt bude objavljen,
                upišite njegovu adresu.
              </p>
              <div>
                <button type="submit" className={buttonClass}>
                  Sačuvaj prodavnicu
                </button>
              </div>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>Povezivanje sajta</h2>
            <p className={sectionHint}>
              Sajt prodavnice čita proizvode i šalje porudžbine preko API-ja na ovoj adresi. Na bilo
              koji sajt se dodaje jednim redom:
            </p>
            <div className={codeClass}>{`<script src="${crmUrl}/sdk.js"></script>`}</div>
            <div className="mt-[12px] flex flex-wrap gap-[12px]">
              <a href="/demo.html" target="_blank" className={quietButtonClass}>
                Probna prodavnica ↗
              </a>
              <a href="/api/v1/products" target="_blank" className={quietButtonClass}>
                API: proizvodi ↗
              </a>
              <a href="/api/v1/store" target="_blank" className={quietButtonClass}>
                API: prodavnica ↗
              </a>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>Dostava</h2>
            <p className={sectionHint}>
              Cena dostave se dodaje na svaku porudžbinu. Kada je besplatna dostava uključena, ne
              naplaćuje se od upisanog iznosa naviše; gleda se vrednost proizvoda, posle popusta.
            </p>
            <form action={saveShippingAction} className="flex flex-col gap-[16px]">
              <label className={labelClass}>
                Cena dostave ({store.currency})
                <input
                  name="price"
                  type="number"
                  min="0"
                  step={priceStep}
                  required
                  defaultValue={fromMinor(shipping.price, decimals)}
                  className={inputClass}
                />
              </label>
              <label className={checkboxLabel}>
                <Checkbox name="freeEnabled" defaultChecked={shipping.freeEnabled} />
                Besplatna dostava za veće porudžbine
              </label>
              <label className={labelClass}>
                Besplatna od iznosa ({store.currency})
                <input
                  name="freeFrom"
                  type="number"
                  min="0"
                  step={priceStep}
                  defaultValue={shipping.freeFrom ? fromMinor(shipping.freeFrom, decimals) : ""}
                  className={inputClass}
                />
              </label>
              <label className={checkboxLabel}>
                <Checkbox name="pickupEnabled" defaultChecked={shipping.pickupEnabled} />
                Kupac može da izabere preuzimanje u salonu (bez dostave)
              </label>
              <div>
                <button type="submit" className={buttonClass}>
                  Sačuvaj dostavu
                </button>
              </div>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>Plaćanje</h2>
            <p className={sectionHint}>
              Načini plaćanja koje kupac može da izabere pri poručivanju. Nijedan ne traži ugovor sa
              bankom ni proviziju.
            </p>
            <form action={savePaymentAction} className="flex flex-col gap-[16px]">
              <label className={checkboxLabel}>
                <Checkbox name="cod" defaultChecked={payment.cod} />
                Plaćanje pouzećem — kupac plaća kuriru
              </label>
              <label className={checkboxLabel}>
                <Checkbox name="bank" defaultChecked={payment.bank} />
                Uplata na račun — kupac dobija podatke za uplatu
              </label>
              <label className={labelClass}>
                Podaci za uplatu (primalac, broj računa, svrha) — kupac ih vidi posle porudžbine i u
                emailu; broj porudžbine se dodaje kao poziv na broj
                <textarea
                  name="bankInstructions"
                  defaultValue={payment.bankInstructions}
                  maxLength={2000}
                  className={`${inputClass} min-h-[100px]`}
                />
              </label>
              <div>
                <button type="submit" className={buttonClass}>
                  Sačuvaj plaćanje
                </button>
              </div>
            </form>
          </section>
        </div>
        <div className={columnClass}>
          <section className={sectionClass}>
            <h2 className={sectionTitle}>Logo i favicon</h2>
            <p className={sectionHint}>
              Logo se prikazuje u zaglavlju sajta i u emailu o porudžbini. Boje i fontovi su u delu{" "}
              <Link href={`${ADMIN_PATH}/izgled`} className={textLinkClass}>
                Izgled sajta
              </Link>
              .
            </p>
            <form action={saveAppearanceAction} className="flex flex-col gap-[16px]">
              <div className={twoColumns}>
                <div className={labelClass}>
                  Logo (PNG ili WebP providne pozadine)
                  <div className="flex flex-wrap items-center gap-[12px]">
                    <Thumb src={logo} alt="Logo" contain />
                    <input
                      type="file"
                      name="logo"
                      accept={IMAGE_ACCEPT}
                      aria-label="Logo"
                      className={fileClass}
                    />
                  </div>
                  {logo && (
                    <label className="flex cursor-pointer items-center gap-[10px] text-ink">
                      <Checkbox name="logoRemove" />
                      Ukloni logo
                    </label>
                  )}
                </div>
                <div className={labelClass}>
                  Favicon (kvadratni PNG, bar 64 × 64 px)
                  <div className="flex flex-wrap items-center gap-[12px]">
                    <Thumb src={favicon} alt="Favicon" contain />
                    <input
                      type="file"
                      name="favicon"
                      accept={IMAGE_ACCEPT}
                      aria-label="Favicon"
                      className={fileClass}
                    />
                  </div>
                  {favicon && (
                    <label className="flex cursor-pointer items-center gap-[10px] text-ink">
                      <Checkbox name="faviconRemove" />
                      Ukloni favicon
                    </label>
                  )}
                </div>
              </div>

              <div>
                <button type="submit" className={buttonClass}>
                  Sačuvaj logo i favicon
                </button>
              </div>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>Email o porudžbini</h2>
            <p className={sectionHint}>
              Kada neko poruči, šalje se email preko vašeg email naloga. Porudžbina se uvek sačuva u
              panelu, i kada slanje ne uspe.
            </p>
            <form action={saveMailAction} className="flex flex-col gap-[16px]">
              <label className={checkboxLabel}>
                <Checkbox name="notifySeller" defaultChecked={mail.notifySeller} />
                Šalji meni email za svaku novu porudžbinu
              </label>
              <label className={checkboxLabel}>
                <Checkbox name="notifyCustomer" defaultChecked={mail.notifyCustomer} />
                Šalji kupcu potvrdu porudžbine
              </label>

              <div className={twoColumns}>
                <label className={labelClass}>
                  Vaš email (ovde stižu porudžbine)
                  <input
                    name="sellerEmail"
                    type="email"
                    defaultValue={mail.sellerEmail}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Ime pošiljaoca (ako je prazno, naziv prodavnice)
                  <input name="fromName" defaultValue={mail.fromName} className={inputClass} />
                </label>
              </div>

              <h3 className={groupTitle}>Nalog sa kog se šalje (SMTP)</h3>
              <p className="mt-[-12px] text-[14px] text-muted">
                Podatke daje vaš email provajder ili hosting. Za Gmail: server smtp.gmail.com, port
                587, korisničko ime je vaša adresa, a lozinka je „lozinka za aplikacije“ iz Google
                naloga, ne vaša obična lozinka.
              </p>
              <div className={twoColumns}>
                <label className={labelClass}>
                  SMTP server
                  <input
                    name="smtpHost"
                    defaultValue={mail.smtpHost}
                    placeholder="npr. smtp.gmail.com"
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Port (587, ili 465 za SSL)
                  <input
                    name="smtpPort"
                    type="number"
                    min="1"
                    max="65535"
                    required
                    defaultValue={mail.smtpPort}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Korisničko ime
                  <input
                    name="smtpUser"
                    autoComplete="off"
                    defaultValue={mail.smtpUser}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Lozinka
                  <input
                    name="smtpPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder={mail.smtpPassword ? "sačuvana — upišite samo ako je menjate" : ""}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Adresa pošiljaoca (ako je prazno, koristi se korisničko ime)
                  <input
                    name="fromEmail"
                    type="email"
                    defaultValue={mail.fromEmail}
                    className={inputClass}
                  />
                </label>
              </div>

              <div>
                <button type="submit" className={buttonClass}>
                  Sačuvaj email podešavanja
                </button>
              </div>
            </form>
            <form action={sendTestEmailAction} className="mt-[12px]">
              <button type="submit" className={quietButtonClass}>
                Pošalji probni email na moju adresu
              </button>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>Šablon emaila</h2>
            <p className={sectionHint}>
              Trenutno se koristi{" "}
              <strong>{mail.customTemplate ? "vaš šablon" : "naš šablon"}</strong>. Isti šablon ide
              i vama i kupcu; razlikuju se naslov i uvodna rečenica. Naš šablon prati boje i logo iz
              dela Izgled.
            </p>
            <div className="flex flex-wrap gap-[12px]">
              <a href={previewPath} target="_blank" className={quietButtonClass}>
                Pregled: email kupcu ↗
              </a>
              <a href={`${previewPath}?za=prodavac`} target="_blank" className={quietButtonClass}>
                Pregled: email meni ↗
              </a>
              <a href={`${ADMIN_PATH}/podesavanja/sablon`} className={quietButtonClass}>
                Preuzmi naš šablon
              </a>
            </div>

            <form
              action={uploadTemplateAction}
              className="mt-[16px] flex flex-wrap items-end gap-[12px] border-t border-line pt-[16px]"
            >
              <label className={`${labelClass} min-w-[220px] grow`}>
                Vaš šablon (HTML fajl, do 300 KB)
                <input
                  type="file"
                  name="template"
                  accept=".html,.htm,text/html"
                  required
                  className={`${fileClass} min-h-[44px]`}
                />
              </label>
              <button type="submit" className={buttonClass}>
                Ubaci šablon
              </button>
            </form>
            {mail.customTemplate && (
              <form action={resetTemplateAction} className="mt-[12px]">
                <button type="submit" className={quietButtonClass}>
                  Vrati naš šablon
                </button>
              </form>
            )}

            <details className="mt-[16px] border-t border-line pt-[12px] text-[14px]">
              <summary className="cursor-pointer text-[15px]">
                Mesta u šablonu koja se zamenjuju podacima porudžbine
              </summary>
              <table className="mt-[8px] w-full">
                <tbody>
                  {templatePlaceholders.map((placeholder) => (
                    <tr key={placeholder.key} className="border-t border-line align-top">
                      <td className="py-[6px] pr-[16px] font-mono text-[13px] whitespace-nowrap">
                        {`{{${placeholder.key}}}`}
                      </td>
                      <td className="py-[6px] text-muted">{placeholder.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
