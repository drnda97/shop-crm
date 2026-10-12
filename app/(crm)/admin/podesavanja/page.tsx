import { getPanelT } from "@/lib/i18n/server";
import { langName, LANGS } from "@/lib/i18n";
import { headers } from "next/headers";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { templatePlaceholders } from "@/lib/email-template";
import { fromMinor } from "@/lib/format";
import { PAYMENT_PROVIDERS } from "@/lib/payments";
import { STATUS_EMAILS, statusEmailLabels } from "@/lib/settings";
import { ShippingEditor } from "./shipping-editor";
import {
  resetTemplateAction,
  saveAppearanceAction,
  saveMailAction,
  savePaymentAction,
  saveStoreAction,
  sendTestEmailAction,
  uploadTemplateAction,
  saveAnalyticsAction,
  saveStatusEmailsAction,
  saveTaxAction,
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
  const t = await getPanelT();
  await requireAdmin("settings");
  const { greska, ok } = await searchParams;
  // Lozinka za SMTP se namerno ne šalje u formu.
  const { store, logo, favicon, mail, shipping, payment, tax, analytics } = await getSettings();
  const providers = PAYMENT_PROVIDERS.map((provider) => ({ id: provider.id, label: t(provider.label), ready: provider.ready() }));
  const previewPath = `${ADMIN_PATH}/podesavanja/pregled`;
  const decimals = store.currencyDecimals;

  // Adresa ovog CRM-a, za primer povezivanja sajta.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const crmUrl = process.env.PUBLIC_URL?.replace(/\/+$/, "") ?? `${protocol}://${host}`;

  return (
    <>
      <PageHeader title={t("Opšta podešavanja")} error={greska} notice={ok} />

      {/* Na širokom ekranu dve kolone; na užem se sekcije ređaju jedna ispod druge. */}
      <div className="grid items-start gap-[16px] xl:grid-cols-2">
        <div className={columnClass}>
          <section className={sectionClass}>
            <h2 className={sectionTitle}>{t("Prodavnica")}</h2>
            <p className={sectionHint}>
              {t("Naziv i kontakt idu u email kupcu i preko API-ja na sajt. Valuta važi za sve cene.")}
            </p>
            <form action={saveStoreAction} className="flex flex-col gap-[16px]">
              <div className={twoColumns}>
                <label className={labelClass}>
                  {t("Naziv prodavnice *")}
                  <input name="name" required defaultValue={store.name} className={inputClass} />
                </label>
                <label className={labelClass}>
                  {t("Telefon")}
                  <input name="phone" defaultValue={store.phone} className={inputClass} />
                </label>
                <label className={labelClass}>
                  {t("Email prodavnice")}
                  <input
                    name="email"
                    type="email"
                    defaultValue={store.email}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Adresa")}
                  <input name="address" defaultValue={store.address} className={inputClass} />
                </label>
              </div>

              <h3 className={groupTitle}>{t("Valuta i zemlja")}</h3>
              <div className={twoColumns}>
                <label className={labelClass}>
                  {t("Oznaka valute *")}
                  <input
                    name="currency"
                    required
                    maxLength={8}
                    defaultValue={store.currency}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Zapis iznosa")}
                  <select
                    name="currencyDecimals"
                    defaultValue={String(decimals)}
                    className={inputClass}
                  >
                    <option value="0">{t("Celi iznosi (1.250 RSD)")}</option>
                    <option value="2">{t("Sa dve decimale (12,50 €)")}</option>
                  </select>
                </label>
                <label className={labelClass}>
                  {t("Pozivni broj zemlje (bez plusa)")}
                  <input
                    name="phonePrefix"
                    defaultValue={store.phonePrefix}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Početak nasumičnih kodova za popust")}
                  <input
                    name="codePrefix"
                    maxLength={12}
                    defaultValue={store.codePrefix}
                    className={`${inputClass} uppercase`}
                  />
                </label>
                <label className={labelClass}>
                  {t("Jezik sajta i poruka kupcima")}
                  <select name="language" defaultValue={store.language} className={inputClass}>
                    {[...new Set([...Object.keys(LANGS), store.language, ...store.languages])].map((id) => (
                      <option key={id} value={id}>
                        {langName(id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  {t("Dodatni jezici sajta")}
                  <input name="languages" defaultValue={store.languages.join(", ")} placeholder="en, de, fr" className={inputClass} />
                  <span className="text-[13.5px] font-normal text-muted">
                    {t("Oznake jezika razdvojene zarezom (en, de, fr, it…). Kupac bira jezik u zaglavlju sajta, a adrese dobijaju početak /en, /de. Tekstove prevodite u delu Prevodi; dok prevoda nema, prikazuje se glavni jezik.")}
                  </span>
                </label>
                <label className={labelClass}>
                  {t("Jezik panela")}
                  <select name="panelLanguage" defaultValue={store.panelLanguage} className={inputClass}>
                    {Object.entries(LANGS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  {t("Jezik datuma")}
                  <input name="locale" defaultValue={store.locale} className={inputClass} />
                </label>
                <label className={labelClass}>
                  {t("Vremenska zona")}
                  <input name="timeZone" defaultValue={store.timeZone} className={inputClass} />
                </label>
              </div>
              <p className="mt-[-8px] text-[14px] text-muted">
                {t("Zapis iznosa izaberite pre unosa proizvoda: ako ga promenite kasnije, već upisane cene se čitaju sto puta veće ili manje. Po pozivnom broju se isti kupac prepoznaje i kada jednom upiše 064…, a drugi put +38164…")}
              </p>

              <h3 className={groupTitle}>{t("Sajt prodavnice")}</h3>
              <label className={labelClass}>
                {t("Adresa sajta (link „Otvori sajt“ u meniju)")}
                <input
                  name="storefrontUrl"
                  type="url"
                  defaultValue={store.storefrontUrl}
                  placeholder="https://mojsajt.rs"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                {t("Sajtovi koji smeju da zovu API iz pregledača — jedan po redu, npr. https://mojsajt.rs")}
                <textarea
                  name="allowedOrigins"
                  defaultValue={store.allowedOrigins}
                  className={`${inputClass} min-h-[80px] font-mono text-[14px]`}
                />
              </label>
              <p className="mt-[-8px] text-[14px] text-muted">
                {t("Dok je polje prazno, API može da zove bilo koji sajt. Kada sajt bude objavljen, upišite njegovu adresu.")}
              </p>
              <div>
                <button type="submit" className={buttonClass}>
                  {t("Sačuvaj prodavnicu")}
                </button>
              </div>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>{t("Povezivanje sajta")}</h2>
            <p className={sectionHint}>
              {t("Sajt prodavnice čita proizvode i šalje porudžbine preko API-ja na ovoj adresi. Na bilo koji sajt se dodaje jednim redom:")}
            </p>
            <div className={codeClass}>{`<script src="${crmUrl}/sdk.js"></script>`}</div>
            <div className="mt-[12px] flex flex-wrap gap-[12px]">
              <a href="/demo.html" target="_blank" className={quietButtonClass}>
                {t("Probna prodavnica ↗")}
              </a>
              <a href="/api/v1/products" target="_blank" className={quietButtonClass}>
                {t("API: proizvodi ↗")}
              </a>
              <a href="/api/v1/store" target="_blank" className={quietButtonClass}>
                {t("API: prodavnica ↗")}
              </a>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>{t("Dostava")}</h2>
            <p className={sectionHint}>
              {t("Načini dostave koje kupac bira pri poručivanju. Svaki ima svoju cenu (stalnu ili po težini), prag za besplatnu dostavu i, po želji, zonu u koju se isporučuje. Prvi način dostave na adresu je podrazumevan.")}
            </p>
            <ShippingEditor
              currency={store.currency}
              methods={shipping.methods.map((method) => ({
                ...method,
                price: fromMinor(method.price, decimals),
                freeFrom: fromMinor(method.freeFrom, decimals),
                weightRates: method.weightRates.map((rate) => ({
                  upTo: String(rate.upTo / 1000),
                  price: fromMinor(rate.price, decimals),
                })),
              }))}
            />
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>{t("Plaćanje")}</h2>
            <p className={sectionHint}>
              {t("Načini plaćanja koje kupac može da izabere pri poručivanju. Nijedan ne traži ugovor sa bankom ni proviziju.")}
            </p>
            <form action={savePaymentAction} className="flex flex-col gap-[16px]">
              <label className={checkboxLabel}>
                <Checkbox name="cod" defaultChecked={payment.cod} />
                {t("Plaćanje pouzećem — kupac plaća kuriru")}
              </label>
              <label className={checkboxLabel}>
                <Checkbox name="bank" defaultChecked={payment.bank} />
                {t("Uplata na račun — kupac dobija podatke za uplatu")}
              </label>
              <label className={labelClass}>
                {t("Podaci za uplatu (primalac, broj računa, svrha) — kupac ih vidi posle porudžbine i u emailu; broj porudžbine se dodaje kao poziv na broj")}
                <textarea
                  name="bankInstructions"
                  defaultValue={payment.bankInstructions}
                  maxLength={2000}
                  className={`${inputClass} min-h-[100px]`}
                />
              </label>
              <label className={checkboxLabel}>
                <Checkbox name="card" defaultChecked={payment.card} />
                {t("Plaćanje karticom — traži povezan procesor")}
              </label>
              <label className={labelClass}>
                {t("Procesor kartica")}
                <select name="cardProvider" defaultValue={payment.cardProvider} className={inputClass}>
                  <option value="">{t("— nijedan —")}</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id} disabled={!provider.ready}>
                      {t(provider.label)}
                      {provider.ready ? "" : t(" (nije povezan)")}
                    </option>
                  ))}
                </select>
                <span className="font-sans text-[14px] font-normal text-muted">
                  {providers.some((provider) => provider.ready)
                    ? t("Kartica se nudi kupcu kada je uključena i procesor izabran.")
                    : t("Nijedan procesor nije povezan, pa se kartica ne nudi kupcu ni kada je uključena. Procesor banke se dopisuje u lib/payments.ts.")}
                </span>
              </label>
              <div>
                <button type="submit" className={buttonClass}>
                  {t("Sačuvaj plaćanje")}
                </button>
              </div>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>{t("Analitika")}</h2>
            <p className={sectionHint}>
              {t("Merenje poseta i kupovina. Kodovi se učitavaju tek kada posetilac pristane u traci za kolačiće, koja se prikazuje čim upišete bar jednu oznaku. Bez oznaka sajt ne koristi kolačiće za praćenje i traka se ne prikazuje.")}
            </p>
            <form action={saveAnalyticsAction} className="flex flex-col gap-[16px]">
              <label className={labelClass}>
                {t("Google Analytics 4 — oznaka merenja")}
                <input name="ga4" defaultValue={analytics.ga4} placeholder={t("G-XXXXXXXXXX")} autoComplete="off" className={inputClass} />
              </label>
              <label className={labelClass}>
                {t("Meta (Facebook) Pixel ID")}
                <input name="metaPixel" defaultValue={analytics.metaPixel} placeholder="123456789012345" autoComplete="off" inputMode="numeric" className={inputClass} />
              </label>
              <div>
                <button type="submit" className={buttonClass}>
                  {t("Sačuvaj analitiku")}
                </button>
              </div>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>{t("Račun i PDV")}</h2>
            <p className={sectionHint}>
{t("Podaci za račun u PDF-u. Račun iz panela nije fiskalni račun: fiskalizaciju vodite kroz svoj fiskalni uređaj ili servis.")}
            </p>
            <form action={saveTaxAction} className="flex flex-col gap-[16px]">
              <label className={labelClass}>
                {t("Podaci firme (pun naziv, sedište, PIB, matični broj, tekući račun)")}
                <textarea
                  name="legal"
                  defaultValue={store.legal}
                  maxLength={1000}
                  className={`${inputClass} min-h-[110px]`}
                />
              </label>
              <label className={checkboxLabel}>
                <Checkbox name="taxEnabled" defaultChecked={tax.enabled} />
                {t("Prodavnica je u sistemu PDV-a — na računu se iskazuju osnovica i PDV")}
              </label>
              <label className={labelClass}>
                {t("Stopa PDV-a (%)")}
                <input
                  name="taxPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={tax.percent}
                  className={inputClass}
                />
                <span className="font-sans text-[14px] font-normal text-muted">
                  {t("Cene u prodavnici već sadrže PDV; stopa služi samo da se on iskaže na računu.")}
                </span>
              </label>
              <label className={labelClass}>
                {t("Račun u PDF-u u emailu kupcu")}
                <select name="invoiceEmail" defaultValue={tax.invoiceEmail} className={inputClass}>
                  <option value="none">{t("Ne šalji")}</option>
                  <option value="order">{t("Uz potvrdu porudžbine")}</option>
                  <option value="shipped">{t("Uz poruku da je porudžbina poslata")}</option>
                </select>
                <span className="font-sans text-[14px] font-normal text-muted">
                  {t("Račun se uvek može preuzeti iz porudžbine u panelu, a prijavljen kupac ga vidi u svom nalogu.")}
                </span>
              </label>
              <div>
                <button type="submit" className={buttonClass}>
                  {t("Sačuvaj račun i PDV")}
                </button>
              </div>
            </form>
          </section>
        </div>
        <div className={columnClass}>
          <section className={sectionClass}>
            <h2 className={sectionTitle}>{t("Logo i favicon")}</h2>
            <p className={sectionHint}>
              {t("Logo se prikazuje u zaglavlju sajta i u emailu o porudžbini. Boje i fontovi su u delu")}{" "}
              <Link href={`${ADMIN_PATH}/izgled`} className={textLinkClass}>
                {t("Izgled sajta")}
              </Link>
              .
            </p>
            <form action={saveAppearanceAction} className="flex flex-col gap-[16px]">
              <div className={twoColumns}>
                <div className={labelClass}>
                  {t("Logo (PNG ili WebP providne pozadine)")}
                  <div className="flex flex-wrap items-center gap-[12px]">
                    <Thumb src={logo} alt={t("Logo")} contain />
                    <input
                      type="file"
                      name="logo"
                      accept={IMAGE_ACCEPT}
                      aria-label={t("Logo")}
                      className={fileClass}
                    />
                  </div>
                  {logo && (
                    <label className="flex cursor-pointer items-center gap-[10px] text-ink">
                      <Checkbox name="logoRemove" />
                      {t("Ukloni logo")}
                    </label>
                  )}
                </div>
                <div className={labelClass}>
                  {t("Favicon (kvadratni PNG, bar 64 × 64 px)")}
                  <div className="flex flex-wrap items-center gap-[12px]">
                    <Thumb src={favicon} alt={t("Favicon")} contain />
                    <input
                      type="file"
                      name="favicon"
                      accept={IMAGE_ACCEPT}
                      aria-label={t("Favicon")}
                      className={fileClass}
                    />
                  </div>
                  {favicon && (
                    <label className="flex cursor-pointer items-center gap-[10px] text-ink">
                      <Checkbox name="faviconRemove" />
                      {t("Ukloni favicon")}
                    </label>
                  )}
                </div>
              </div>

              <div>
                <button type="submit" className={buttonClass}>
                  {t("Sačuvaj logo i favicon")}
                </button>
              </div>
            </form>
          </section>

          <section id="email" className={`${sectionClass} scroll-mt-[20px]`}>
            <h2 className={sectionTitle}>{t("Email o porudžbini")}</h2>
            <p className={sectionHint}>
              {t("Kada neko poruči, šalje se email preko vašeg email naloga. Porudžbina se uvek sačuva u panelu, i kada slanje ne uspe.")}
            </p>
            <form action={saveMailAction} className="flex flex-col gap-[16px]">
              <label className={checkboxLabel}>
                <Checkbox name="notifySeller" defaultChecked={mail.notifySeller} />
                {t("Šalji meni email za svaku novu porudžbinu")}
              </label>
              <label className={checkboxLabel}>
                <Checkbox name="notifyCustomer" defaultChecked={mail.notifyCustomer} />
                {t("Šalji kupcu potvrdu porudžbine")}
              </label>

              <div className={twoColumns}>
                <label className={labelClass}>
                  {t("Vaš email (ovde stižu porudžbine)")}
                  <input
                    name="sellerEmail"
                    type="email"
                    defaultValue={mail.sellerEmail}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Ime pošiljaoca (ako je prazno, naziv prodavnice)")}
                  <input name="fromName" defaultValue={mail.fromName} className={inputClass} />
                </label>
              </div>

              <h3 className={groupTitle}>{t("Nalog sa kog se šalje (SMTP)")}</h3>
              <p className="mt-[-12px] text-[14px] text-muted">
                {t("Podatke daje vaš email provajder ili hosting. Za Gmail: server smtp.gmail.com, port 587, korisničko ime je vaša adresa, a lozinka je „lozinka za aplikacije“ iz Google naloga, ne vaša obična lozinka.")}
              </p>
              <div className={twoColumns}>
                <label className={labelClass}>
                  {t("SMTP server")}
                  <input
                    name="smtpHost"
                    defaultValue={mail.smtpHost}
                    placeholder={t("npr. smtp.gmail.com")}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Port (587, ili 465 za SSL)")}
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
                  {t("Korisničko ime")}
                  <input
                    name="smtpUser"
                    autoComplete="off"
                    defaultValue={mail.smtpUser}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Lozinka")}
                  <input
                    name="smtpPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder={mail.smtpPassword ? t("sačuvana — upišite samo ako je menjate") : ""}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Adresa pošiljaoca (ako je prazno, koristi se korisničko ime)")}
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
                  {t("Sačuvaj email podešavanja")}
                </button>
              </div>
            </form>
            <form action={sendTestEmailAction} className="mt-[12px]">
              <button type="submit" className={quietButtonClass}>
                {t("Pošalji probni email na moju adresu")}
              </button>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>{t("Poruke o statusu")}</h2>
            <p className={sectionHint}>
{t("Email kupcu kada porudžbina promeni status ili kada upišete povraćaj. U tekstu se")}{" "}
              {"{ime}"}, {"{broj}"}, {"{pracenje}"} {t("(broj pošiljke i link, kada su upisani),")}{" "}
              {"{iznos}"} {t("(kod povraćaja) i")} {"{prodavnica}"} {t("menjaju podacima porudžbine. Ispod teksta idu stavke i iznosi, kao u potvrdi porudžbine.")}
            </p>
            <form action={saveStatusEmailsAction} className="flex flex-col gap-[18px]">
              {STATUS_EMAILS.map((key) => (
                <fieldset key={key} className="flex flex-col gap-[10px] border-t border-line pt-[14px] first:border-t-0 first:pt-0">
                  <label className={checkboxLabel}>
                    <Checkbox name={`${key}Enabled`} defaultChecked={mail.statusEmails[key].enabled} />
                    {t("Šalji")} {t(statusEmailLabels[key])}
                  </label>
                  <label className={labelClass}>
                    {t("Naslov")}
                    <input
                      name={`${key}Subject`}
                      maxLength={200}
                      defaultValue={mail.statusEmails[key].subject}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    {t("Tekst")}
                    <textarea
                      name={`${key}Text`}
                      maxLength={2000}
                      defaultValue={mail.statusEmails[key].text}
                      className={`${inputClass} min-h-[80px]`}
                    />
                  </label>
                </fieldset>
              ))}
              <div>
                <button type="submit" className={buttonClass}>
                  {t("Sačuvaj poruke")}
                </button>
              </div>
            </form>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitle}>{t("Šablon emaila")}</h2>
            <p className={sectionHint}>
              {t("Trenutno se koristi")}{" "}
              <strong>{mail.customTemplate ? t("vaš šablon") : t("naš šablon")}</strong>{t(". Isti šablon ide i vama i kupcu; razlikuju se naslov i uvodna rečenica. Naš šablon prati boje i logo iz dela Izgled.")}
            </p>
            <div className="flex flex-wrap gap-[12px]">
              <a href={previewPath} target="_blank" className={quietButtonClass}>
                {t("Pregled: email kupcu ↗")}
              </a>
              <a href={`${previewPath}?za=prodavac`} target="_blank" className={quietButtonClass}>
                {t("Pregled: email meni ↗")}
              </a>
              <a href={`${ADMIN_PATH}/podesavanja/sablon`} className={quietButtonClass}>
                {t("Preuzmi naš šablon")}
              </a>
            </div>

            <form
              action={uploadTemplateAction}
              className="mt-[16px] flex flex-wrap items-end gap-[12px] border-t border-line pt-[16px]"
            >
              <label className={`${labelClass} min-w-[220px] grow`}>
                {t("Vaš šablon (HTML fajl, do 300 KB)")}
                <input
                  type="file"
                  name="template"
                  accept=".html,.htm,text/html"
                  required
                  className={`${fileClass} min-h-[44px]`}
                />
              </label>
              <button type="submit" className={buttonClass}>
                {t("Ubaci šablon")}
              </button>
            </form>
            {mail.customTemplate && (
              <form action={resetTemplateAction} className="mt-[12px]">
                <button type="submit" className={quietButtonClass}>
                  {t("Vrati naš šablon")}
                </button>
              </form>
            )}

            <details className="mt-[16px] border-t border-line pt-[12px] text-[14px]">
              <summary className="cursor-pointer text-[15px]">
                {t("Mesta u šablonu koja se zamenjuju podacima porudžbine")}
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
