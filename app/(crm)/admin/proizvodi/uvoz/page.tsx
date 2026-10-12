import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getProducts, getSettings, getStoredValue } from "@/lib/content";
import { formatMoney } from "@/lib/format";
import { formatLabels, type ParsedImport } from "@/lib/product-import";
import { currencyOf } from "@/lib/settings";
import { applyImportAction, cancelImportAction, startImportAction } from "../../actions";
import { IMPORT_KEY } from "../../import-key";
import { buttonClass, cardClass, Checkbox, fileClass, PageHeader, panelTitleClass, quietButtonClass, textLinkClass } from "../../ui";

type ImportPageProps = { searchParams: Promise<{ greska?: string; ok?: string }> };

export default async function ImportPage({ searchParams }: ImportPageProps) {
  const t = await getPanelT();
  await requireAdmin("catalog");
  const { greska, ok } = await searchParams;
  const [stored, products, settings] = await Promise.all([getStoredValue(IMPORT_KEY), getProducts(), getSettings()]);
  const pending = stored ? (JSON.parse(stored) as ParsedImport & { fileName: string }) : null;
  const currency = currencyOf(settings);

  return (
    <>
      <Link href={`${ADMIN_PATH}/proizvodi`} className={textLinkClass}>
        {t("← Proizvodi")}
      </Link>
      <div className="mt-[12px]">
        <PageHeader
          title={t("Uvoz proizvoda")}
          hint={t("Uvozi se CSV fajl: izvoz proizvoda iz Shopify-ja ili WooCommerce-a, ili fajl koji je napravio izvoz iz ovog panela. Pre upisa vidite šta će biti dodato i izmenjeno.")}
          error={greska}
          notice={ok}
        />
      </div>

      {!pending ? (
        <div className="flex max-w-[820px] flex-col gap-[16px]">
          <form action={startImportAction} className={`${cardClass} flex flex-col gap-[16px]`}>
            <h2 className={panelTitleClass}>{t("Izaberite fajl")}</h2>
            <input type="file" name="file" accept=".csv,text/csv" required aria-label={t("CSV fajl")} className={fileClass} />
            <div>
              <button type="submit" className={buttonClass}>
                {t("Pročitaj fajl")}
              </button>
            </div>
          </form>
          <div className={`${cardClass} flex flex-col gap-[10px] text-[15px]`}>
            <h2 className={panelTitleClass}>{t("Odakle fajl")}</h2>
            <p>
              <strong>{t("Shopify:")}</strong> {t("Products → Export → „All products”, „Plain CSV file”.")}
            </p>
            <p>
              <strong>{t("WooCommerce:")}</strong> {t("Products → All Products → Export, sa svim kolonama.")}
            </p>
            <p>
              <strong>{t("Ovaj panel:")}</strong>{" "}
              <a href={`${ADMIN_PATH}/proizvodi/izvoz`} className={textLinkClass}>
                {t("preuzmite izvoz")}
              </a>
              {t(", izmenite ga u Excel-u i uvezite nazad. Proizvod sa oznakom koja već postoji se menja, a nova oznaka pravi nov proizvod.")}
            </p>
            <p className="text-muted">
              {t("Uvoze se naziv, opis, cene, stanje, kategorije, opcije, varijante i slike. Ne uvoze se utisci, oznake (tagovi), porezi i dostava.")}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-[16px]">
          <div className={`${cardClass} flex flex-col gap-[12px]`}>
            <h2 className={panelTitleClass}>
              {pending.fileName} · {t(formatLabels[pending.format])}
            </h2>
            <p className="text-[15.5px]">
              {t("Proizvoda:")} <strong>{pending.products.length}</strong> {t("— novih")}{" "}
              <strong>{pending.products.filter((item) => !products.some((product) => product.slug === item.slug)).length}</strong>{t(", postojećih koji će biti izmenjeni")}{" "}
              <strong>{pending.products.filter((item) => products.some((product) => product.slug === item.slug)).length}</strong>{t(". Varijanti:")} <strong>{pending.products.reduce((sum, item) => sum + item.variants.length, 0)}</strong>{t(". Slika:")}{" "}
              <strong>{new Set(pending.products.flatMap((item) => item.images)).size}</strong>.
            </p>
            {pending.warnings.length > 0 && (
              <div className="rounded-[18px] bg-band px-[18px] py-[14px] text-[14.5px]">
                <div className="mb-[6px] font-display font-bold">{t("Upozorenja (")}{pending.warnings.length})</div>
                <ul className="flex list-disc flex-col gap-[4px] pl-[18px]">
                  {pending.warnings.slice(0, 30).map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
                {pending.warnings.length > 30 && <p className="mt-[6px] text-muted">{t("…i još")} {pending.warnings.length - 30}.</p>}
              </div>
            )}
            <form action={applyImportAction} className="flex flex-wrap items-center gap-[14px]">
              <label className="flex cursor-pointer items-center gap-[10px] text-[15px]">
                <Checkbox name="images" defaultChecked />
                {t("Preuzmi slike sa adresa iz fajla")}
              </label>
              <button type="submit" className={buttonClass} disabled={pending.products.length === 0}>
                {t("Uvezi")} {pending.products.length} {t("proizvoda")}
              </button>
            </form>
            <form action={cancelImportAction}>
              <button type="submit" className={quietButtonClass}>
                {t("Odustani")}
              </button>
            </form>
            <p className="text-[14px] text-muted">
              {t("Preuzimanje slika traje: računajte oko sekund po slici. Bez preuzimanja, postojeći proizvodi zadržavaju svoje slike, a novi nastaju bez njih.")}
            </p>
          </div>

          <div className={cardClass}>
            <h2 className={`${panelTitleClass} mb-[8px]`}>{t("Prvih")} {Math.min(20, pending.products.length)} {t("proizvoda")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14.5px]">
                <thead>
                  <tr className="font-display text-[13px] text-muted">
                    <th className="py-[6px] pr-[16px] font-semibold">{t("Naziv")}</th>
                    <th className="py-[6px] pr-[16px] font-semibold">{t("Oznaka")}</th>
                    <th className="py-[6px] pr-[16px] font-semibold">{t("Cena")}</th>
                    <th className="py-[6px] pr-[16px] font-semibold">{t("Kategorije")}</th>
                    <th className="py-[6px] pr-[16px] font-semibold">{t("Varijante")}</th>
                    <th className="py-[6px] font-semibold">{t("Stanje")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.products.slice(0, 20).map((item) => {
                    const exists = products.some((product) => product.slug === item.slug);
                    return (
                      <tr key={item.slug} className="border-t border-line align-top">
                        <td className="py-[8px] pr-[16px] font-display font-bold">
                          {item.name}
                          {!item.active && <span className="font-sans font-normal text-muted"> {t("· nacrt")}</span>}
                        </td>
                        <td className="py-[8px] pr-[16px] text-muted">
                          {item.slug} {exists ? t("· menja se") : t("· nov")}
                        </td>
                        <td className="py-[8px] pr-[16px] whitespace-nowrap">
                          {item.price === null ? "—" : formatMoney(item.salePrice ?? item.price, currency)}
                        </td>
                        <td className="py-[8px] pr-[16px]">{item.categories.map((path) => path.join(" › ")).join(", ") || "—"}</td>
                        <td className="py-[8px] pr-[16px]">
                          {item.options.length === 0 ? "—" : `${item.variants.length} (${item.options.map((option) => option.name).join(", ")})`}
                        </td>
                        <td className="py-[8px]">{item.stockQty ?? (item.inStock ? t("na stanju") : "nema")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
