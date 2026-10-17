import { getPanelT } from "@/lib/i18n/server";
import { langName, LANGS } from "@/lib/i18n";
import { headers } from "next/headers";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { templatePlaceholders } from "@/lib/email-template";
import { fromMinor } from "@/lib/format";
import { PAYMENT_PROVIDERS } from "@/lib/payments";
import { bankText, legalText, STATUS_EMAILS, statusEmailLabels } from "@/lib/settings";
import { ShippingEditor } from "./shipping-editor";
import {
  resetTemplateAction,
  saveAppearanceAction,
  saveMailAction,
  saveAuthAction,
  savePaymentAction,
  saveStoreAction,
  sendTestEmailAction,
  uploadTemplateAction,
  saveAnalyticsAction,
  saveStatusEmailsAction,
  saveTaxAction,
} from "../actions";
import { currencyOptions, dialCodeOptions, languageOptions, localeOptions, timeZoneOptions } from "@/lib/locales";
import { Picker, RowsEditor } from "../pickers";
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

/**
 * Podešavanja po delovima, kao Settings u Shopify-ju: svaki deo je svoja stranica
 * (/admin/podesavanja/{deo}), a bočni meni ih nudi ispod „Podešavanja prodavnice".
 */
export const SETTINGS_PARTS = {
  prodavnica: { slug: "", title: "Opšte" },
  dostava: { slug: "dostava", title: "Dostava" },
  placanje: { slug: "placanje", title: "Plaćanje" },
  porez: { slug: "porez", title: "Porez i račun" },
  email: { slug: "email", title: "Email kupcima" },
  nalozi: { slug: "nalozi", title: "Nalozi kupaca" },
  analitika: { slug: "analitika", title: "Analitika" },
} as const;

export type SettingsPart = keyof typeof SETTINGS_PARTS;

type SettingsViewProps = {
  part: SettingsPart;
  searchParams: Promise<{ greska?: string; ok?: string }>;
};

const sectionClass = cardClass;
const sectionTitle = "text-[22px]";
const sectionHint = "mb-[16px] text-[14px] text-muted";
const groupTitle = "mt-[10px] text-[16px]";
const twoColumns = "grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-[16px]";
/** Četiri polja u redu na širokom ekranu, dva na srednjem, jedno na telefonu; natpis polja u jednom redu. */
const fourColumns = "grid items-start gap-[16px] sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0 [&>*]:whitespace-nowrap";
const checkboxLabel = "flex cursor-pointer items-start gap-[10px] text-[15px] leading-[22px]";
const codeClass = "rounded-[14px] bg-band px-[14px] py-[12px] font-mono text-[13px] break-all";

export async function SettingsView({ part, searchParams }: SettingsViewProps) {
  const t = await getPanelT();
  await requireAdmin("settings");
  const { greska, ok } = await searchParams;
  // Lozinka za SMTP se namerno ne šalje u formu.
  const { store, logo, favicon, mail, shipping, payment, tax, analytics, auth } = await getSettings();
  // Podaci za uplatu: dok nisu upisani, predlažu se primalac i račun iz podataka firme.
  const bank = Object.values(payment.bankDetails).some(Boolean)
    ? payment.bankDetails
    : {
        ...payment.bankDetails,
        recipient: [store.company.name, store.company.address].filter(Boolean).join(", "),
        account: store.company.account,
      };
  const providers = PAYMENT_PROVIDERS.map((provider) => ({ id: provider.id, label: t(provider.label), ready: provider.ready() }));
  const previewPath = `${ADMIN_PATH}/podesavanja/pregled`;
  const decimals = store.currencyDecimals;
  // Posle čuvanja akcija vraća na ovu stranicu (skriveno polje „back" u svakoj formi).
  const path = `${ADMIN_PATH}/podesavanja${SETTINGS_PARTS[part].slug ? `/${SETTINGS_PARTS[part].slug}` : ""}`;
  const backField = <input type="hidden" name="back" value={path} />;

  // Adresa ovog CRM-a, za primer povezivanja sajta.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const crmUrl = process.env.PUBLIC_URL?.replace(/\/+$/, "") ?? `${protocol}://${host}`;

  return (
    <>
      <PageHeader title={t(SETTINGS_PARTS[part].title)} error={greska} notice={ok} />
      {/* Kartice jedna ispod druge, preko cele širine; Email kupcima ima svoje dve kolone (ispod). */}
      <div className="flex flex-col gap-[16px]">

      {part === "prodavnica" && (
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
            {backField}
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
      )}
      {part === "prodavnica" && (
        <section className={sectionClass}>
          <h2 className={sectionTitle}>{t("Prodavnica")}</h2>
          <p className={sectionHint}>
            {t("Naziv i kontakt idu u email kupcu i preko API-ja na sajt. Valuta važi za sve cene.")}
          </p>
          <form action={saveStoreAction} className="flex flex-col gap-[16px]">
            {backField}
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
            {/* Stalan broj kolona i natpisi u jednom redu, da polja u redu budu u istoj visini. */}
            <div className={fourColumns}>
              <div className={labelClass}>
                {t("Valuta *")}
                <Picker
                  name="currency"
                  label={t("Valuta")}
                  options={currencyOptions(store.panelLanguage, store.currency)}
                  defaultValue={[store.currency]}
                  placeholder={t("Potražite valutu…")}
                />
              </div>
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
              <div className={labelClass}>
                {t("Zemlja (pozivni broj)")}
                <Picker
                  name="phonePrefix"
                  label={t("Zemlja (pozivni broj)")}
                  options={dialCodeOptions(store.panelLanguage, store.phonePrefix)}
                  defaultValue={store.phonePrefix ? [store.phonePrefix] : []}
                  noneLabel={t("Bez pozivnog broja")}
                  placeholder={t("Potražite zemlju…")}
                />
              </div>
              <label className={labelClass}>
                {t("Početak kodova za popust")}
                <input
                  name="codePrefix"
                  maxLength={12}
                  defaultValue={store.codePrefix}
                  className={`${inputClass} uppercase`}
                />
              </label>
            </div>
            <p className="mt-[-8px] text-[14px] text-muted">
              {t("Zapis iznosa izaberite pre unosa proizvoda: ako ga promenite kasnije, već upisane cene se čitaju sto puta veće ili manje. Po pozivnom broju se isti kupac prepoznaje i kada jednom upiše 064…, a drugi put +38164… Kod za popust koji panel pravi sam počinje ovim slovima, npr. KOD-7K3Q9X.")}
            </p>

            <h3 className={groupTitle}>{t("Jezik i vreme")}</h3>
            <div className={`${fourColumns} min-[1500px]:grid-cols-5`}>
              <label className={labelClass}>
                {t("Jezik sajta")}
                <select name="language" defaultValue={store.language} className={inputClass}>
                  {[...new Set([...Object.keys(LANGS), store.language, ...store.languages])].map((id) => (
                    <option key={id} value={id}>
                      {langName(id)}
                    </option>
                  ))}
                </select>
              </label>
              <div className={labelClass}>
                {t("Dodatni jezici sajta")}
                <Picker
                  name="languages"
                  multiple
                  label={t("Dodatni jezici sajta")}
                  options={languageOptions(store.panelLanguage, store.languages)}
                  exclude={[store.language]}
                  defaultValue={store.languages}
                  placeholder={t("Npr. engleski, nemački…")}
                />
              </div>
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
              <div className={labelClass}>
                {t("Zapis datuma")}
                <Picker
                  name="locale"
                  label={t("Zapis datuma i brojeva")}
                  options={localeOptions(store.panelLanguage, store.locale)}
                  defaultValue={[store.locale]}
                  placeholder={t("Potražite jezik ili zemlju…")}
                />
              </div>
              <div className={labelClass}>
                {t("Vremenska zona")}
                <Picker
                  name="timeZone"
                  label={t("Vremenska zona")}
                  options={timeZoneOptions(store.timeZone, store.panelLanguage)}
                  defaultValue={[store.timeZone]}
                  placeholder={t("Grad na engleskom ili zona, npr. Belgrade…")}
                />
              </div>
            </div>
            <p className="mt-[-8px] text-[14px] text-muted">
              {t("Jezik sajta je glavni jezik prodavnice i poruka kupcima. Uz dodatne jezike kupac bira jezik u zaglavlju sajta, a adrese dobijaju početak /en, /de; tekstove prevodite u delu Prevodi, a dok prevoda nema, prikazuje se glavni jezik. Zapis datuma i vremenska zona važe za datume u panelu, emailu i računu.")}
            </p>

            <h3 className={groupTitle}>{t("Sajt prodavnice")}</h3>
            <label className={labelClass}>
              {t("Adresa sajta (link „Otvori sajt“ u meniju i linkovi u emailu: nova lozinka, korpa, novosti)")}
              <input
                name="storefrontUrl"
                type="url"
                defaultValue={store.storefrontUrl}
                placeholder="https://mojsajt.rs"
                className={inputClass}
              />
            </label>
            <div className={labelClass}>
              {t("Sajtovi koji smeju da zovu API iz pregledača")}
              <RowsEditor
                name="allowedOriginsJson"
                fields={[{ key: "url", label: t("Adresa sajta"), placeholder: "https://mojsajt.rs" }]}
                defaultRows={store.allowedOrigins.split(/[\s,]+/).filter(Boolean).map((url) => ({ url }))}
                addLabel={t("Dodaj sajt")}
                emptyLabel={t("Nijedan sajt nije upisan.")}
                max={20}
              />
            </div>
            <p className="mt-[-8px] text-[14px] text-muted">
              {t("Dok nijedan sajt nije upisan, API iz pregledača sme da zove samo ova adresa (panel i prodavnica), nijedan drugi sajt. Upišite sajt koji je vaš i samo on prolazi. Adresa sajta iznad se dodaje sama.")}
            </p>
            <div>
              <button type="submit" className={buttonClass}>
                {t("Sačuvaj prodavnicu")}
              </button>
            </div>
          </form>
        </section>
      )}
      {part === "prodavnica" && (
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
      )}
      {part === "dostava" && (
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
      )}
      {part === "placanje" && (
        <section className={sectionClass}>
          <h2 className={sectionTitle}>{t("Plaćanje")}</h2>
          <p className={sectionHint}>
            {t("Načini plaćanja koje kupac može da izabere pri poručivanju. Nijedan ne traži ugovor sa bankom ni proviziju.")}
          </p>
          <form action={savePaymentAction} className="flex flex-col gap-[16px]">
            {backField}
            <label className={checkboxLabel}>
              <Checkbox name="cod" defaultChecked={payment.cod} />
              {t("Plaćanje pouzećem — kupac plaća kuriru")}
            </label>
            <label className={checkboxLabel}>
              <Checkbox name="bank" defaultChecked={payment.bank} />
              {t("Uplata na račun — kupac dobija podatke za uplatu")}
            </label>
            <div className="flex flex-col gap-[12px] rounded-[18px] bg-band p-[16px]">
              <span className="font-display text-[15px] font-bold">{t("Podaci za uplatu")}</span>
              <div className={fourColumns}>
                <label className={labelClass}>
                  {t("Primalac *")}
                  <input name="bankRecipient" maxLength={255} defaultValue={bank.recipient} placeholder={t("Naziv firme, adresa")} className={inputClass} />
                </label>
                <label className={labelClass}>
                  {t("Broj računa *")}
                  <input name="bankAccount" maxLength={60} defaultValue={bank.account} placeholder="160-0000000000000-00" className={inputClass} />
                </label>
                <label className={labelClass}>
                  {t("Banka")}
                  <input name="bankName" maxLength={120} defaultValue={bank.bank} placeholder={t("neobavezno")} className={inputClass} />
                </label>
                <label className={labelClass}>
                  {t("Svrha uplate")}
                  <input name="bankPurpose" maxLength={255} defaultValue={bank.purpose} placeholder={t("npr. Plaćanje porudžbine")} className={inputClass} />
                </label>
              </div>
              <label className={labelClass}>
                {t("Napomena za kupca")}
                <input name="bankNote" maxLength={500} defaultValue={bank.note} placeholder={t("neobavezno, npr. Porudžbinu šaljemo kada uplata stigne.")} className={inputClass} />
              </label>
              <div className="rounded-[14px] bg-white px-[14px] py-[12px] text-[14.5px]">
                <span className="mb-[4px] block font-display text-[13px] font-bold text-muted">{t("Kupac vidi posle porudžbine i u emailu:")}</span>
                <span className="whitespace-pre-wrap">{bankText(bank) || t("— upišite primaoca i broj računa —")}</span>
                <span className="mt-[4px] block">{t("Iznos: iznos porudžbine · Poziv na broj: broj porudžbine")}</span>
              </div>
            </div>
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
            <label className={checkboxLabel}>
              <Checkbox name="returns" defaultChecked={payment.returns} />
              {t("Povrat — kupac može da zatraži povrat sa stranice za praćenje porudžbine")}
            </label>
            <div>
              <button type="submit" className={buttonClass}>
                {t("Sačuvaj plaćanje")}
              </button>
            </div>
          </form>
        </section>
      )}
      {part === "porez" && (
        <section className={sectionClass}>
          <h2 className={sectionTitle}>{t("Račun i PDV")}</h2>
          <p className={sectionHint}>
        {t("Podaci za račun u PDF-u. Račun iz panela nije fiskalni račun: fiskalizaciju vodite kroz svoj fiskalni uređaj ili servis.")}
          </p>
          <form action={saveTaxAction} className="flex flex-col gap-[16px]">
            {backField}
            <span className="font-display text-[15px] font-bold">{t("Podaci firme na računu")}</span>
            <div className={fourColumns}>
              <label className={`${labelClass} xl:col-span-2`}>
                {t("Pun naziv firme")}
                <input name="companyName" maxLength={255} defaultValue={store.company.name} placeholder={t("npr. Demo Shop d.o.o.")} className={inputClass} />
              </label>
              <label className={`${labelClass} xl:col-span-2`}>
                {t("Adresa sedišta")}
                <input name="companyAddress" maxLength={255} defaultValue={store.company.address} placeholder={t("Ulica i broj, poštanski broj i mesto")} className={inputClass} />
              </label>
              <label className={labelClass}>
                {t("PIB")}
                <input name="companyPib" inputMode="numeric" maxLength={20} defaultValue={store.company.pib} placeholder="100000000" className={inputClass} />
              </label>
              <label className={labelClass}>
                {t("Matični broj")}
                <input name="companyMb" inputMode="numeric" maxLength={20} defaultValue={store.company.mb} placeholder="20000000" className={inputClass} />
              </label>
              <label className={`${labelClass} xl:col-span-2`}>
                {t("Tekući račun")}
                <input name="companyAccount" maxLength={60} defaultValue={store.company.account} placeholder="160-0000000000000-00" className={inputClass} />
              </label>
            </div>
            <div className="rounded-[14px] bg-band px-[14px] py-[12px] text-[14.5px]">
              <span className="mb-[4px] block font-display text-[13px] font-bold text-muted">{t("Na računu piše:")}</span>
              <span className="whitespace-pre-wrap">{legalText(store.company) || t("— naziv, adresa i kontakt prodavnice iz Opšte —")}</span>
            </div>
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
      )}
      {part === "email" && (
        // Dve nezavisne kolone: levo nalog i šablon, desno poruke o statusu, da ispod kraće kolone ne ostane rupa.
        <div className="grid items-start gap-[16px] xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-[16px]">
            <section id="email" className={`${sectionClass} scroll-mt-[20px]`}>
              <h2 className={sectionTitle}>{t("Email o porudžbini")}</h2>
              <p className={sectionHint}>
                {t("Kada neko poruči, šalje se email preko vašeg email naloga. Porudžbina se uvek sačuva u panelu, i kada slanje ne uspe.")}
              </p>
              <form id="mail-settings" action={saveMailAction} className="flex flex-col gap-[16px]">
                {backField}
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

              </form>
              {/* Čuvanje i probni email u istom redu; dugme za čuvanje pripada formi iznad (atribut form). */}
              <div className="mt-[16px] flex flex-wrap items-center gap-[10px]">
                <button type="submit" form="mail-settings" className={buttonClass}>
                  {t("Sačuvaj email podešavanja")}
                </button>
                <form action={sendTestEmailAction}>
                  {backField}
                  <button type="submit" className={quietButtonClass}>
                    {t("Pošalji probni email na moju adresu")}
                  </button>
                </form>
              </div>
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
                id="template-upload"
                action={uploadTemplateAction}
                className="mt-[16px] flex flex-wrap items-end gap-[12px] border-t border-line pt-[16px]"
              >
                {backField}
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
              </form>
              {/* „Ubaci šablon" i „Vrati naš šablon" u istom redu; prvo dugme pripada formi iznad (atribut form). */}
              <div className="mt-[12px] flex flex-wrap items-center gap-[10px]">
                <button type="submit" form="template-upload" className={buttonClass}>
                  {t("Ubaci šablon")}
                </button>
                {mail.customTemplate && (
                  <form action={resetTemplateAction}>
                    {backField}
                    <button type="submit" className={quietButtonClass}>
                      {t("Vrati naš šablon")}
                    </button>
                  </form>
                )}
              </div>

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
          <section className={sectionClass}>
            <h2 className={sectionTitle}>{t("Poruke o statusu")}</h2>
            <p className={sectionHint}>
          {t("Email kupcu kada porudžbina promeni status ili kada upišete povraćaj. U tekstu se")}{" "}
              {"{ime}"}, {"{broj}"}, {"{pracenje}"} {t("(broj pošiljke i link, kada su upisani),")}{" "}
              {"{iznos}"} {t("(kod povraćaja) i")} {"{prodavnica}"} {t("menjaju podacima porudžbine. Ispod teksta idu stavke i iznosi, kao u potvrdi porudžbine.")}
            </p>
            <form action={saveStatusEmailsAction} className="flex flex-col gap-[18px]">
              {backField}
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
        </div>
      )}
      {part === "nalozi" && (
        <section className={sectionClass}>
          <h2 className={sectionTitle}>{t("Prijava kupaca")}</h2>
          <p className={sectionHint}>
            {t("Kupac se uvek može prijaviti emailom i lozinkom. Da bi imao i dugme „Nastavi sa Google nalogom“, napravite OAuth klijenta u Google Cloud konzoli (APIs & Services → Credentials → OAuth client ID, vrsta Web application), upišite mu adresu ispod kao „Authorized redirect URI“, pa ovde prepišite Client ID i Client secret. Dok su polja prazna, dugme se ne prikazuje.")}
          </p>
          <p className={`${codeClass} mb-[16px]`}>{crmUrl}/api/auth/google/callback</p>
          <form action={saveAuthAction} className="flex flex-col gap-[16px]">
            {backField}
            <label className={labelClass}>
              {t("Google Client ID")}
              <input name="googleClientId" defaultValue={auth.googleClientId} placeholder="1234567890-abc.apps.googleusercontent.com" autoComplete="off" className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("Google Client secret")}
              <input
                name="googleClientSecret"
                type="password"
                autoComplete="off"
                placeholder={auth.googleClientSecret ? t("Upisana; ostavite prazno da ostane ista") : ""}
                className={inputClass}
              />
            </label>
            <div>
              <button type="submit" className={buttonClass}>
                {t("Sačuvaj prijavu kupaca")}
              </button>
            </div>
          </form>
        </section>
      )}
      {part === "analitika" && (
        <section className={sectionClass}>
          <h2 className={sectionTitle}>{t("Analitika")}</h2>
          <p className={sectionHint}>
            {t("Merenje poseta i kupovina. Kodovi se učitavaju tek kada posetilac pristane u traci za kolačiće, koja se prikazuje čim upišete bar jednu oznaku. Bez oznaka sajt ne koristi kolačiće za praćenje i traka se ne prikazuje.")}
          </p>
          <form action={saveAnalyticsAction} className="flex flex-col gap-[16px]">
            {backField}
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
      )}
      </div>
    </>
  );
}
