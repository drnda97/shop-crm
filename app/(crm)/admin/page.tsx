import Link from "next/link";
import { redirect } from "next/navigation";
import { ADMIN_PATH, getCurrentAdmin, roleCan } from "@/lib/admin-auth";
import { hasPrice, isSoldOut, lowStockUnits, soldOutVariants } from "@/lib/catalog";
import { getProducts, getSettings } from "@/lib/content";
import { formatMoney, formatOrderCount, formatPieces } from "@/lib/format";
import { isMailConfigured } from "@/lib/order-email";
import { getOpenReturns } from "@/lib/returns";
import { countPendingReviews } from "@/lib/reviews";
import { getOrders, getSalesStats } from "@/lib/order-store";
import { currencyOf } from "@/lib/settings";
import { dateFormats, StatusBadge } from "./order-ui";
import { cardClass, PageHeader, textLinkClass } from "./ui";

const sectionTitle = "mb-[14px] text-[20px]";
const lift =
  "transition-[translate,box-shadow] duration-500 ease-shop hover:-translate-y-[4px] hover:shadow-lift";

/** Promena u odnosu na prethodni period, npr. „↑ 25%". Bez prethodnih podataka nema poređenja. */
function change(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return "isto kao prethodnih 30 dana";
  return `${percent > 0 ? "↑" : "↓"} ${Math.abs(percent)}% u odnosu na prethodnih 30 dana`;
}

function StatTile({
  label,
  value,
  notes,
  dark = false,
}: {
  label: string;
  value: string;
  notes: (string | null)[];
  /** Istaknuta pločica: tamna, kao tamne sekcije u prodavnici. */
  dark?: boolean;
}) {
  const quiet = dark ? "text-[#B9C6C9]" : "text-muted";
  return (
    <div className={`${cardClass} ${lift} flex flex-col gap-[2px] ${dark ? "!bg-ink text-paper" : ""}`}>
      <div className={`text-[14px] ${quiet}`}>{label}</div>
      <div className="my-[4px] font-display text-[30px] leading-[1.1] font-bold tracking-[-0.03em]">
        {value}
      </div>
      {notes.filter(Boolean).map((note) => (
        <div key={note} className={`text-[13px] ${quiet}`}>
          {note}
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  // Prijavu ovde rešava layout (prikazuje formu), pa se neprijavljenom samo ne daje sadržaj.
  const user = await getCurrentAdmin();
  if (!user) return null;
  // Pregled prodaje je za uloge koje vide porudžbine; ostale idu na svoj deo panela.
  if (!roleCan(user.role, "orders")) redirect(`${ADMIN_PATH}/stranice`);

  const [orders, products, settings, openReturns, pendingReviews] = await Promise.all([
    getOrders(),
    getProducts(),
    getSettings(),
    getOpenReturns(),
    countPendingReviews(),
  ]);
  const currency = currencyOf(settings);
  const money = (value: number | null) => formatMoney(value, currency);
  const { orderDate, shortDay } = dateFormats(settings.store);

  const emailFailed = orders.filter((order) => order.emailError).length;
  const stats = getSalesStats(orders, settings.store.timeZone);
  const maxDayOrders = Math.max(1, ...stats.days.map((day) => day.orders));
  const topProducts = stats.topProducts.slice(0, 8);
  const maxProductQty = Math.max(1, ...topProducts.map((product) => product.qty));
  const listed = products.filter((product) => product.active);
  const withoutPrice = listed.filter((product) => !hasPrice(product));
  const withoutImage = listed.filter((product) => !product.image);
  // Stanje se gleda tamo gde se vodi: uz proizvod, ili uz svaku njegovu varijantu.
  const soldOut = listed.filter(isSoldOut);
  const soldOutParts = listed.flatMap(soldOutVariants);
  // Pri kraju: vodi se broj komada i pao je na prag proizvoda.
  const runningLow = listed.flatMap(lowStockUnits);
  const recent = orders.slice(-5).reverse();
  const names = (items: { name: string }[]) =>
    items
      .slice(0, 6)
      .map((item) => item.name)
      .join(", ") + (items.length > 6 ? "…" : "");

  const attention = [
    products.length === 0 && {
      text: "Prodavnica je prazna — dodajte prvi proizvod",
      href: `${ADMIN_PATH}/proizvodi/novi`,
    },
    !isMailConfigured(settings) && {
      text: "Email nije podešen — za nove porudžbine ne stiže poruka ni vama ni kupcu",
      href: `${ADMIN_PATH}/podesavanja`,
    },
    emailFailed > 0 && {
      text: `Email nije poslat: ${formatOrderCount(emailFailed)}`,
      href: `${ADMIN_PATH}/porudzbine`,
    },
    stats.waiting > 0 && {
      text: `Čeka na obradu: ${formatOrderCount(stats.waiting)}`,
      href: `${ADMIN_PATH}/porudzbine?status=new`,
    },
    openReturns.length > 0 && {
      text: `Zahtevi za povrat koji čekaju odgovor: ${openReturns.map((request) => `#${request.orderNumber}`).join(", ")}`,
      href: `${ADMIN_PATH}/porudzbine/${openReturns[0].orderNumber}`,
    },
    pendingReviews > 0 && {
      text: `Utisci koji čekaju odobrenje: ${pendingReviews}`,
      href: `${ADMIN_PATH}/utisci`,
    },
    withoutPrice.length > 0 && {
      text: `Bez upisane cene, pa ne mogu da se poruče: ${names(withoutPrice)}`,
      href: `${ADMIN_PATH}/proizvodi`,
    },
    soldOut.length > 0 && {
      text: `Nema na stanju: ${names(soldOut)}`,
      href: `${ADMIN_PATH}/proizvodi`,
    },
    soldOutParts.length > 0 && {
      text: `Rasprodate varijante: ${names(soldOutParts)}`,
      href: `${ADMIN_PATH}/proizvodi`,
    },
    runningLow.length > 0 && {
      text: `Pri kraju: ${runningLow
        .slice(0, 6)
        .map((unit) => `${unit.name} (${unit.qty} kom.)`)
        .join(", ")}${runningLow.length > 6 ? "…" : ""}`,
      href: `${ADMIN_PATH}/proizvodi`,
    },
    withoutImage.length > 0 && {
      text: `Bez slike: ${names(withoutImage)}`,
      href: `${ADMIN_PATH}/proizvodi`,
    },
  ].filter((item) => item !== false);

  return (
    <>
      <PageHeader
        title="Pregled"
        hint="Prodaja je vrednost poručenih proizvoda posle popusta, bez dostave. Otkazane porudžbine se ne računaju."
      />

      {attention.length > 0 && (
        <div className={`${cardClass} mb-[16px]`}>
          <h2 className={sectionTitle}>Za pažnju</h2>
          <ul className="flex flex-col text-[15px]">
            {attention.map((item) => (
              <li key={item.text} className="border-t border-line first:border-t-0">
                <Link
                  href={item.href}
                  className="group flex items-center gap-[12px] py-[10px] font-medium hover:text-ink"
                >
                  <span className="size-[8px] shrink-0 rounded-full bg-gold" />
                  <span className="grow">{item.text}</span>
                  <span className="flex size-[32px] shrink-0 items-center justify-center rounded-full bg-band transition-[background-color,translate] duration-500 ease-shop group-hover:translate-x-[4px] group-hover:bg-gold">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(176px,100%),1fr))] gap-[16px]">
        <StatTile
          dark
          label="Prodaja · poslednjih 30 dana"
          value={money(stats.last30.sales)}
          notes={[
            change(stats.last30.sales, stats.previous30.sales),
            `Ukupno do sada: ${money(stats.all.sales)}`,
          ]}
        />
        <StatTile
          label="Porudžbine · poslednjih 30 dana"
          value={String(stats.last30.orders)}
          notes={[
            change(stats.last30.orders, stats.previous30.orders),
            `Poslednjih 7 dana: ${stats.last7.orders} · ukupno: ${stats.all.orders}`,
          ]}
        />
        <StatTile
          label="Prosečna porudžbina"
          value={money(stats.all.average)}
          notes={[
            stats.all.orders > 0
              ? `U proseku ${(stats.all.pieces / stats.all.orders).toFixed(1).replace(".", ",")} komada po porudžbini`
              : null,
          ]}
        />
        <StatTile
          label="Prodato komada"
          value={String(stats.all.pieces)}
          notes={[`Poslednjih 30 dana: ${stats.last30.pieces}`]}
        />
        <StatTile
          label="Kupci"
          value={String(stats.customers)}
          notes={[
            `Poručili više puta: ${stats.returningCustomers}`,
            stats.cancelled > 0 ? `Otkazano: ${formatOrderCount(stats.cancelled)}` : null,
          ]}
        />
      </div>

      <div className={`${cardClass} mt-[16px]`}>
        <h2 className={sectionTitle}>Porudžbine po danima · poslednjih 30 dana</h2>
        {stats.last30.orders === 0 ? (
          <p className="text-[15px] text-muted">U poslednjih 30 dana nema porudžbina.</p>
        ) : (
          <>
            <div className="flex gap-[8px]">
              <div className="flex h-[160px] flex-col justify-between text-right text-[12px] leading-none text-muted">
                <span>{maxDayOrders}</span>
                <span>0</span>
              </div>
              <div className="flex h-[160px] grow gap-[2px] border-b border-line-strong">
                {stats.days.map((day, index) => (
                  // Cela kolona je meta za miš i tastaturu, ne samo tanak stubić.
                  <div
                    key={day.key}
                    tabIndex={0}
                    className="group relative flex min-w-0 grow items-end justify-center rounded-t-[6px] transition-colors duration-300 hover:bg-band focus-visible:bg-band"
                  >
                    {day.orders > 0 && (
                      <div
                        className="w-full max-w-[18px] origin-bottom animate-grow-y rounded-t-[6px] bg-gold"
                        style={{
                          height: `${(day.orders / maxDayOrders) * 100}%`,
                          animationDelay: `${0.2 + index * 0.02}s`,
                        }}
                      />
                    )}
                    <div
                      role="tooltip"
                      className={`pointer-events-none absolute bottom-full z-10 mb-[6px] hidden rounded-[12px] bg-ink px-[12px] py-[8px] text-[13px] leading-[1.4] whitespace-nowrap text-paper group-hover:block group-focus-visible:block ${
                        index < 5 ? "left-0" : index > 24 ? "right-0" : ""
                      }`}
                    >
                      <div>{shortDay(day.date)}</div>
                      <div>
                        {formatOrderCount(day.orders)} · {money(day.sales)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-[6px] flex justify-between pl-[24px] text-[12px] text-muted">
              <span>{shortDay(stats.days[0].date)}</span>
              <span>{shortDay(stats.days[14].date)}</span>
              <span>danas</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-[16px] grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] items-start gap-[16px]">
        <div className={cardClass}>
          <h2 className={sectionTitle}>Najprodavaniji proizvodi</h2>
          {topProducts.length === 0 ? (
            <p className="text-[15px] text-muted">
              Još nema porudžbina. Kada stignu, ovde se vidi šta se najviše prodaje.
            </p>
          ) : (
            <ol className="flex flex-col gap-[14px]">
              {topProducts.map((product, index) => (
                <li key={product.slug} className="flex flex-col gap-[4px]">
                  <div className="flex items-baseline justify-between gap-[12px] text-[15px]">
                    <span className="font-medium">
                      {index + 1}. {product.name}
                    </span>
                    <span className="shrink-0 text-[14px] text-muted">
                      {formatPieces(product.qty)} · {money(product.sales)}
                    </span>
                  </div>
                  <div className="h-[8px] overflow-hidden rounded-full bg-band">
                    <div
                      className="h-full origin-left animate-grow-x rounded-full bg-gold"
                      style={{
                        width: `${(product.qty / maxProductQty) * 100}%`,
                        animationDelay: `${0.3 + index * 0.06}s`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex flex-col gap-[16px]">
          <div className={cardClass}>
            <div className="flex items-baseline justify-between gap-[12px]">
              <h2 className={sectionTitle}>Poslednje porudžbine</h2>
              <Link href={`${ADMIN_PATH}/porudzbine`} className={textLinkClass}>
                Sve porudžbine
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-[15px] text-muted">Još nema porudžbina.</p>
            ) : (
              <div className="flex flex-col">
                {recent.map((order) => (
                  <div
                    key={order.number}
                    className="flex flex-wrap items-center justify-between gap-x-[12px] gap-y-[2px] border-t border-line py-[10px] text-[15px] first:border-t-0"
                  >
                    <div>
                      <div>
                        #{order.number} · {order.customer.name}
                      </div>
                      <div className="text-[13px] text-muted">
                        {orderDate(order.receivedAt)} · {order.customer.city}
                      </div>
                    </div>
                    <div className="flex items-center gap-[10px]">
                      <span>{money(order.total)}</span>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={cardClass}>
            <h2 className={sectionTitle}>Gde šaljemo najviše</h2>
            {stats.topCities.length === 0 ? (
              <p className="text-[15px] text-muted">Još nema porudžbina.</p>
            ) : (
              <table className="w-full text-[15px]">
                <tbody>
                  {stats.topCities.slice(0, 6).map((city) => (
                    <tr key={city.name} className="border-t border-line first:border-t-0">
                      <td className="py-[8px]">{city.name}</td>
                      <td className="py-[8px] text-right text-muted">
                        {formatOrderCount(city.orders)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
