import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { currentPrice, isOnSale, variantLabel } from "@/lib/catalog";
import { getProduct, getSettings } from "@/lib/content";
import { formatMoney, fromMinor } from "@/lib/format";
import { sizedSrc } from "@/lib/media";
import { currencyOf } from "@/lib/settings";
import { saveVariantAction } from "../../../../actions";
import {
  buttonClass,
  Checkbox,
  chipClass,
  chipOffClass,
  chipOnClass,
  fieldRowClass,
  fileClass,
  formGridClass,
  IMAGE_ACCEPT,
  IMAGE_HINT,
  inputClass,
  labelClass,
  PageHeader,
  panelClass,
  panelTitleClass,
  quietButtonClass,
  stackClass,
  textLinkClass,
} from "../../../../ui";

type VariantPageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ greska?: string; ok?: string }>;
};

const hintClass = "font-sans text-[14px] font-normal text-muted";

/** Stranica jedne varijante: sopstvena slika, cena, akcija samo za nju, šifra i stanje. */
export default async function VariantPage({ params, searchParams }: VariantPageProps) {
  const t = await getPanelT();
  await requireAdmin("catalog");
  const [{ slug, id }, { greska, ok }, settings] = await Promise.all([params, searchParams, getSettings()]);
  const product = await getProduct(slug);
  const variant = product?.variants.find((candidate) => candidate.id === id);
  if (!product || !variant) notFound();

  const currency = currencyOf(settings);
  const money = (value: number | null) => (value === null ? t("nije upisana") : formatMoney(value, currency));
  const step = currency.decimals === 0 ? "1" : "0.01";
  const images = [product.image, ...product.gallery].filter((src): src is string => Boolean(src));
  const productPath = `${ADMIN_PATH}/proizvodi/${product.slug}`;
  const label = variantLabel(variant);
  const at = product.variants.indexOf(variant);
  const previous = product.variants[at - 1];
  const next = product.variants[at + 1];

  return (
    <>
      <Link href={productPath} className={textLinkClass}>
        ← {product.name}
      </Link>
      <div className="mt-[12px]">
        <PageHeader
          title={label}
          hint={t("Varijanta proizvoda {a}. Kupac je bira na stranici proizvoda; ovde su njena slika, cena i stanje.", { a: product.name })}
          error={greska}
          notice={ok}
          action={
            <div className="flex flex-wrap gap-[8px]">
              {previous && (
                <Link href={`${productPath}/varijanta/${previous.id}`} className={quietButtonClass}>
                  ← {variantLabel(previous)}
                </Link>
              )}
              {next && (
                <Link href={`${productPath}/varijanta/${next.id}`} className={quietButtonClass}>
                  {variantLabel(next)} →
                </Link>
              )}
            </div>
          }
        />
      </div>

      {/* Sve varijante proizvoda, za prelaz sa jedne na drugu. */}
      <nav aria-label={t("Varijante proizvoda")} className="mb-[16px] flex flex-wrap gap-[6px]">
        {product.variants.map((item) => (
          <Link
            key={item.id}
            href={`${productPath}/varijanta/${item.id}`}
            aria-current={item.id === variant.id ? "page" : undefined}
            className={`${chipClass} ${item.id === variant.id ? chipOnClass : chipOffClass} ${item.enabled ? "" : "opacity-55"}`}
          >
            {variantLabel(item)}
          </Link>
        ))}
      </nav>

      <form action={saveVariantAction} className="flex flex-col gap-[16px]">
        <input type="hidden" name="slug" value={product.slug} />
        <input type="hidden" name="id" value={variant.id} />

        <div className={formGridClass}>
          <div className={stackClass}>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Slika varijante")}</h2>
              <p className={hintClass}>
                {t("Kada kupac izabere ovu varijantu, na stranici proizvoda se prikazuje njena slika. Bez nje ostaje glavna slika proizvoda.")}
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-[10px]" role="radiogroup" aria-label={t("Slika varijante")}>
                <label className="flex cursor-pointer flex-col items-center gap-[6px] rounded-[16px] p-[6px] text-center text-[13px] has-checked:bg-band has-checked:shadow-[inset_0_0_0_2px_var(--color-ink)]">
                  <input type="radio" name="image" value="" defaultChecked={!variant.image} className="sr-only" />
                  <span className="flex aspect-square w-full items-center justify-center rounded-[12px] bg-ph px-[6px] text-[12px] text-muted">
                    {t("Glavna slika proizvoda")}
                  </span>
                  {t("Bez svoje")}
                </label>
                {images.map((src, index) => (
                  <label
                    key={src}
                    className="flex cursor-pointer flex-col items-center gap-[6px] rounded-[16px] p-[6px] text-center text-[13px] has-checked:bg-band has-checked:shadow-[inset_0_0_0_2px_var(--color-ink)]"
                  >
                    <input type="radio" name="image" value={src} defaultChecked={variant.image === src} className="sr-only" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sizedSrc(src, 320)} alt="" className="aspect-square w-full rounded-[12px] bg-ph object-cover" />
                    {index === 0 ? t("glavna") : t("slika {a}", { a: index + 1 })}
                  </label>
                ))}
              </div>
              <label className={labelClass}>
                {t("Ili ubacite novu sliku")}
                <input type="file" name="imageFile" accept={IMAGE_ACCEPT} className={fileClass} />
                <span className={hintClass}>
                  {t(IMAGE_HINT)}. {t("Nova slika postaje slika ove varijante i dodaje se među slike proizvoda.")}
                </span>
              </label>
            </section>
          </div>

          <div className={stackClass}>
            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Cena")}</h2>
              <div className={fieldRowClass}>
                <label className={labelClass}>
                  {t("Cena (")}
                  {currency.code})
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step={step}
                    defaultValue={fromMinor(variant.price, currency.decimals)}
                    placeholder={t("kao proizvod: {a}", { a: money(product.price) })}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Cena na akciji (")}
                  {currency.code})
                  <input
                    name="salePrice"
                    type="number"
                    min="0"
                    step={step}
                    defaultValue={fromMinor(variant.salePrice, currency.decimals)}
                    placeholder={t("nema akcije")}
                    className={inputClass}
                  />
                </label>
              </div>
              <p className={hintClass}>
                {t("Prazna cena znači cenu proizvoda. Akcija važi samo za ovu varijantu, i kada nema svoju cenu: npr. poslednja dva komada jedne boje na akciji. Kupac sada plaća {a}{b}.", {
                  a: money(currentPrice(product, variant)),
                  b: isOnSale(product, variant) ? t(" (na akciji)") : "",
                })}
              </p>
            </section>

            <section className={panelClass}>
              <h2 className={panelTitleClass}>{t("Stanje i šifra")}</h2>
              <div className={fieldRowClass}>
                <label className={labelClass}>
                  {t("Broj komada na stanju")}
                  <input
                    name="stockQty"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={variant.stockQty ?? ""}
                    placeholder={t("ne vodi se")}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t("Šifra artikla")}
                  <input name="sku" maxLength={64} defaultValue={variant.sku} className={inputClass} />
                </label>
              </div>
              <p className={hintClass}>
                {t("Prazan broj komada: stanje ove varijante se ne vodi i važi ručno stanje proizvoda. Upisan broj se smanjuje sa svakom porudžbinom.")}
              </p>
              <label className="flex cursor-pointer items-center gap-[10px] text-[15px]">
                <Checkbox name="enabled" defaultChecked={variant.enabled} />
                {t("U ponudi — kupac može da izabere ovu varijantu")}
              </label>
            </section>
          </div>
        </div>

        <div className="flex flex-wrap gap-[12px]">
          <button type="submit" className={buttonClass}>
            {t("Sačuvaj varijantu")}
          </button>
          <Link href={productPath} className={quietButtonClass}>
            {t("Nazad na proizvod")}
          </Link>
        </div>
      </form>
    </>
  );
}
