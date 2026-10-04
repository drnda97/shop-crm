import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { currentPrice, hasStock, isOnSale, lowStockLabel } from "@/lib/catalog";
import { getCategories, getProducts, getSettings } from "@/lib/content";
import { formatMoney } from "@/lib/format";
import { currencyOf } from "@/lib/settings";
import { deleteProductAction, moveProductAction, setStockAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
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

const badge = "rounded-full px-[10px] leading-[22px]";
const moveButton =
  "flex size-[28px] cursor-pointer items-center justify-center rounded-[6px] border border-line-strong bg-white text-[13px] hover:border-ink disabled:cursor-default disabled:opacity-30";

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  await requireAdmin();
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
          <Link href={`${ADMIN_PATH}/proizvodi/novi`} className={buttonClass}>
            + Novi proizvod
          </Link>
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
                <div className="text-[17px]">{product.name}</div>
                <div className="text-[14px] text-muted">
                  {categories.find((category) => category.id === product.category)?.label ??
                    "bez kategorije"}
                  {product.sku && ` · ${product.sku}`} ·{" "}
                  {product.price === null ? "bez cene" : formatMoney(product.price, currency)}
                  {isOnSale(product) && ` → na akciji ${formatMoney(currentPrice(product), currency)}`}
                </div>
                <div className="mt-[6px] flex flex-wrap items-center gap-[8px] text-[13px]">
                  {!product.active && (
                    <span className={`${badge} border border-line-strong text-muted`}>Nacrt</span>
                  )}
                  <span
                    className={`${badge} ${
                      hasStock(product) ? "border border-line-strong text-ink" : "bg-ink text-paper"
                    }`}
                  >
                    {hasStock(product) ? "Na stanju" : "Nema na stanju"}
                  </span>
                  {lowStockLabel(product) && (
                    <span className={`${badge} bg-accent text-paper`}>
                      Kupac vidi: {lowStockLabel(product)}
                    </span>
                  )}
                </div>
              </div>
              {/* Stanje bez otvaranja forme: broj komada ako se vodi, inače prekidač na klik. */}
              {product.stockQty !== null ? (
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
    </>
  );
}
