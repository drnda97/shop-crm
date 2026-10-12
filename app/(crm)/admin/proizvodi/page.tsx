import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import {
  categoryTree,
  currentPrice,
  hasPrice,
  hasStock,
  isOnSale,
  isSoldOut,
  lowStockLabel,
  priceRange,
  soldOutVariants,
  variantLabel,
} from "@/lib/catalog";
import { getCategories, getProducts, getSettings } from "@/lib/content";
import { formatMoney } from "@/lib/format";
import { currencyOf } from "@/lib/settings";
import { deleteProductAction, moveProductAction, setStockAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { BulkBar } from "./bulk-bar";
import {
  buttonClass,
  cardClass,
  inputClass,
  PageHeader,
  quietButtonClass,
  rowClass,
  Thumb,
} from "../ui";

type ProductsPageProps = { searchParams: Promise<{ greska?: string; q?: string }> };

const badge = "rounded-full px-[12px] font-display text-[12.5px] leading-[26px] font-bold";
const moveButton =
  "flex size-[28px] cursor-pointer items-center justify-center rounded-full bg-band text-[13px] transition-colors duration-300 hover:bg-gold disabled:cursor-default disabled:opacity-30";

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const t = await getPanelT();
  await requireAdmin("catalog");
  const { greska, q = "" } = await searchParams;
  const [all, categories, settings] = await Promise.all([
    getProducts(),
    getCategories(),
    getSettings(),
  ]);
  const currency = currencyOf(settings);
  const search = q.trim().toLocaleLowerCase();
  const products = search
    ? all.filter((product) =>
        `${product.name} ${product.sku}`.toLocaleLowerCase().includes(search),
      )
    : all;

  return (
    <>
      <PageHeader
        title={t("Proizvodi")}
        hint={t("Stanje se menja ovde na klik, ili upisom broja komada kod proizvoda kojima se broj vodi. Strelice menjaju redosled kojim se proizvodi prikazuju na sajtu.")}
        error={greska}
        action={
          <div className="flex flex-wrap gap-[8px]">
            <Link href={`${ADMIN_PATH}/proizvodi/uvoz`} className={quietButtonClass}>
              {t("Uvoz")}
            </Link>
            <a href={`${ADMIN_PATH}/proizvodi/izvoz`} className={quietButtonClass}>
              {t("Izvoz")}
            </a>
            <Link href={`${ADMIN_PATH}/proizvodi/novi`} className={buttonClass}>
              {t("+ Novi proizvod")}
            </Link>
          </div>
        }
      />

      {all.length > 8 && (
        <form action={`${ADMIN_PATH}/proizvodi`} className="mb-[12px] flex flex-wrap gap-[8px]">
          <div className="min-w-[220px] grow">
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder={t("Naziv ili šifra")}
              aria-label={t("Pretraga proizvoda")}
              className={inputClass}
            />
          </div>
          <button type="submit" className={buttonClass}>
            {t("Traži")}
          </button>
        </form>
      )}

      <div className={cardClass}>
        {products.map((product) => {
          const position = all.indexOf(product);
          return (
            <div key={product.slug} className={rowClass}>
              {/* Polje pripada formi za izmenu više proizvoda (ispod spiska), ne formama u redu. */}
              <input
                type="checkbox"
                form="bulk"
                name="slugs"
                value={product.slug}
                aria-label={t("Označi: {a}", { a: product.name })}
                className="size-[20px] shrink-0 cursor-pointer accent-ink"
              />
              {/* Redosled se menja samo u punom spisku; u pretrazi bi „gore" i „dole" zbunjivalo. */}
              {!search && (
                <form action={moveProductAction} className="flex flex-col gap-[4px]">
                  <input type="hidden" name="slug" value={product.slug} />
                  <button
                    type="submit"
                    name="direction"
                    value="up"
                    disabled={position === 0}
                    aria-label={t("Pomeri gore: {a}", { a: product.name })}
                    className={moveButton}
                  >
                    ↑
                  </button>
                  <button
                    type="submit"
                    name="direction"
                    value="down"
                    disabled={position === all.length - 1}
                    aria-label={t("Pomeri dole: {a}", { a: product.name })}
                    className={moveButton}
                  >
                    ↓
                  </button>
                </form>
              )}
              <Thumb src={product.image} alt={product.name} />
              <div className="min-w-[180px] grow">
                <div className="font-display text-[17px] font-bold">{product.name}</div>
                <div className="text-[14px] text-muted">
                  {categories.find((category) => category.id === product.category)?.label ??
                    t("bez kategorije")}
                  {product.sku && ` · ${product.sku}`} ·{" "}
                  {!hasPrice(product)
                    ? t("bez cene")
                    : priceRange(product).varies
                      ? t("od {a}", { a: formatMoney(priceRange(product).from, currency) })
                      : product.price === null
                        ? formatMoney(priceRange(product).from, currency)
                        : formatMoney(product.price, currency)}
                  {!priceRange(product).varies &&
                    isOnSale(product) &&
                    ` → na akciji ${formatMoney(currentPrice(product), currency)}`}
                  {product.variants.length > 0 && ` · varijanti: ${product.variants.filter((variant) => variant.enabled).length}`}
                </div>
                <div className="mt-[6px] flex flex-wrap items-center gap-[8px] text-[13px]">
                  {!product.active && (
                    <span className={`${badge} bg-band text-muted`}>{t("Nacrt")}</span>
                  )}
                  <span
                    className={`${badge} ${
                      isSoldOut(product) ? "bg-ink text-paper" : "bg-band text-ink"
                    }`}
                  >
                    {isSoldOut(product) ? t("Nema na stanju") : t("Na stanju")}
                  </span>
                  {lowStockLabel(product) && (
                    <span className={`${badge} bg-gold text-ink`}>
                      {t("Kupac vidi:")} {lowStockLabel(product)}
                    </span>
                  )}
                  {/* Kod varijanti: koje su rasprodate i na kojima kupac vidi oznaku „pri kraju". */}
                  {soldOutVariants(product).map((unit) => (
                    <span key={unit.variant?.id} className={`${badge} bg-ink text-paper`}>
                      {unit.variant && variantLabel(unit.variant)}{t(": nema")}
                    </span>
                  ))}
                  {product.variants
                    .filter((variant) => variant.enabled && lowStockLabel(product, variant))
                    .map((variant) => (
                      <span key={variant.id} className={`${badge} bg-gold text-ink`}>
                        {variantLabel(variant)}: {lowStockLabel(product, variant)}
                      </span>
                    ))}
                </div>
              </div>
              {/* Stanje bez otvaranja forme: broj komada ako se vodi, inače prekidač na klik. */}
              {product.variants.length > 0 ? (
                // Stanje varijanti se menja u formi proizvoda; ovde je zbir onih kojima se vodi broj.
                <span className="text-[14px] text-muted">
                  {product.variants.some((variant) => variant.enabled && variant.stockQty !== null)
                    ? `ukupno ${product.variants
                        .filter((variant) => variant.enabled)
                        .reduce((sum, variant) => sum + (variant.stockQty ?? 0), 0)} kom. po varijantama`
                    : t("stanje po varijantama se ne vodi")}
                </span>
              ) : product.stockQty !== null ? (
                <form action={setStockAction} className="flex items-center gap-[6px]">
                  <input type="hidden" name="slug" value={product.slug} />
                  <div className="w-[84px] shrink-0">
                    <input
                      name="stockQty"
                      type="number"
                      min="0"
                      step="1"
                      required
                      defaultValue={product.stockQty}
                      aria-label={t("Broj komada na stanju: {a}", { a: product.name })}
                      className={inputClass}
                    />
                  </div>
                  <button type="submit" className={`${quietButtonClass} whitespace-nowrap`}>
                    {t("Sačuvaj")}
                  </button>
                </form>
              ) : (
                <form action={setStockAction}>
                  <input type="hidden" name="slug" value={product.slug} />
                  <button type="submit" className={quietButtonClass}>
                    {hasStock(product) ? t("Označi da nema") : t("Vrati na stanje")}
                  </button>
                </form>
              )}
              <Link href={`${ADMIN_PATH}/proizvodi/${product.slug}`} className={quietButtonClass}>
                {t("Izmeni")}
              </Link>
              <form action={deleteProductAction}>
                <input type="hidden" name="slug" value={product.slug} />
                <ConfirmButton
                  question={t("Obrisati proizvod „{a}\"?", { a: product.name })}
                  className={quietButtonClass}
                >
                  {t("Obriši")}
                </ConfirmButton>
              </form>
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="text-[15px] text-muted">
            {all.length === 0 ? t("Još nema proizvoda.") : t("Nema proizvoda za ovu pretragu.")}
          </p>
        )}
      </div>
      {products.length > 0 && (
        <BulkBar
          categories={categoryTree(categories).map(({ category, depth }) => ({
            id: category.id,
            label: `${"\u00a0\u00a0".repeat(depth)}${category.label}`,
          }))}
        />
      )}
    </>
  );
}
