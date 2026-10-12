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
        title="Proizvodi"
        hint="Stanje se menja ovde na klik, ili upisom broja komada kod proizvoda kojima se broj vodi. Strelice menjaju redosled kojim se proizvodi prikazuju na sajtu."
        error={greska}
        action={
          <div className="flex flex-wrap gap-[8px]">
            <Link href={`${ADMIN_PATH}/proizvodi/uvoz`} className={quietButtonClass}>
              Uvoz
            </Link>
            <a href={`${ADMIN_PATH}/proizvodi/izvoz`} className={quietButtonClass}>
              Izvoz
            </a>
            <Link href={`${ADMIN_PATH}/proizvodi/novi`} className={buttonClass}>
              + Novi proizvod
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
              placeholder="Naziv ili šifra"
              aria-label="Pretraga proizvoda"
              className={inputClass}
            />
          </div>
          <button type="submit" className={buttonClass}>
            Traži
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
                aria-label={`Označi: ${product.name}`}
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
                    aria-label={`Pomeri gore: ${product.name}`}
                    className={moveButton}
                  >
                    ↑
                  </button>
                  <button
                    type="submit"
                    name="direction"
                    value="down"
                    disabled={position === all.length - 1}
                    aria-label={`Pomeri dole: ${product.name}`}
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
                    "bez kategorije"}
                  {product.sku && ` · ${product.sku}`} ·{" "}
                  {!hasPrice(product)
                    ? "bez cene"
                    : priceRange(product).varies
                      ? `od ${formatMoney(priceRange(product).from, currency)}`
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
                    <span className={`${badge} bg-band text-muted`}>Nacrt</span>
                  )}
                  <span
                    className={`${badge} ${
                      isSoldOut(product) ? "bg-ink text-paper" : "bg-band text-ink"
                    }`}
                  >
                    {isSoldOut(product) ? "Nema na stanju" : "Na stanju"}
                  </span>
                  {lowStockLabel(product) && (
                    <span className={`${badge} bg-gold text-ink`}>
                      Kupac vidi: {lowStockLabel(product)}
                    </span>
                  )}
                  {/* Kod varijanti: koje su rasprodate i na kojima kupac vidi oznaku „pri kraju". */}
                  {soldOutVariants(product).map((unit) => (
                    <span key={unit.variant?.id} className={`${badge} bg-ink text-paper`}>
                      {unit.variant && variantLabel(unit.variant)}: nema
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
                    : "stanje po varijantama se ne vodi"}
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
                      aria-label={`Broj komada na stanju: ${product.name}`}
                      className={inputClass}
                    />
                  </div>
                  <button type="submit" className={`${quietButtonClass} whitespace-nowrap`}>
                    Sačuvaj
                  </button>
                </form>
              ) : (
                <form action={setStockAction}>
                  <input type="hidden" name="slug" value={product.slug} />
                  <button type="submit" className={quietButtonClass}>
                    {hasStock(product) ? "Označi da nema" : "Vrati na stanje"}
                  </button>
                </form>
              )}
              <Link href={`${ADMIN_PATH}/proizvodi/${product.slug}`} className={quietButtonClass}>
                Izmeni
              </Link>
              <form action={deleteProductAction}>
                <input type="hidden" name="slug" value={product.slug} />
                <ConfirmButton
                  question={`Obrisati proizvod „${product.name}"?`}
                  className={quietButtonClass}
                >
                  Obriši
                </ConfirmButton>
              </form>
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="text-[15px] text-muted">
            {all.length === 0 ? "Još nema proizvoda." : "Nema proizvoda za ovu pretragu."}
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
