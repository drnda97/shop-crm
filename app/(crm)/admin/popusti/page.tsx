import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getDiscounts, getSettings } from "@/lib/content";
import { isExpired, type Discount } from "@/lib/discounts";
import { formatMoney, formatWeight, type Currency } from "@/lib/format";
import { getCodeCounts, getCodeUses } from "@/lib/order-store";
import { currencyOf } from "@/lib/settings";
import { deleteDiscountAction, toggleDiscountAction } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { buttonClass, cardClass, PageHeader, quietButtonClass, rowClass } from "../ui";

type DiscountsPageProps = { searchParams: Promise<{ greska?: string }> };

/** Uslov pravila rečima, npr. „posle porudžbine od 3.000 RSD". */
function describeTrigger(discount: Discount, currency: Currency): string {
  if (discount.trigger === "public") return "promo kod za sve kupce";
  if (discount.trigger === "first") return "nagrada posle prve porudžbine kupca";
  return discount.trigger === "amount"
    ? `nagrada posle porudžbine od ${formatMoney(discount.threshold, currency)}`
    : `nagrada posle porudžbine od ${formatWeight(discount.threshold)}`;
}

export default async function DiscountsPage({ searchParams }: DiscountsPageProps) {
  await requireAdmin();
  const { greska } = await searchParams;
  const [discounts, counts, uses, settings] = await Promise.all([
    getDiscounts(),
    getCodeCounts(),
    getCodeUses(),
    getSettings(),
  ]);
  const currency = currencyOf(settings);

  return (
    <>
      <PageHeader
        title="Popusti"
        hint="Promo kod važi za svakog kupca koji ga upiše. Nagrada je kod koji kupac dobija u emailu posle porudžbine, za sledeću kupovinu: šalje se najjača aktivna nagrada čiji je uslov ispunjen, i važi jednom, samo za tog kupca."
        error={greska}
        action={
          <Link href={`${ADMIN_PATH}/popusti/novi`} className={buttonClass}>
            + Novi popust
          </Link>
        }
      />
      <div className={cardClass}>
        {discounts.map((discount) => {
          const active = discount.status === "active";
          const expired = isExpired(discount, settings.store.timeZone);
          const count = counts[discount.id] ?? { sent: 0, used: 0 };
          const usage =
            discount.trigger === "public"
              ? `iskorišćeno: ${uses[discount.code] ?? 0}${discount.maxUses === null ? "" : ` od ${discount.maxUses}`}${discount.expiresAt ? ` · važi do ${discount.expiresAt}` : ""}`
              : `poslato kodova: ${count.sent} · iskorišćeno: ${count.used}`;
          return (
            <div key={discount.id} className={rowClass}>
              <div className="w-[72px] shrink-0 font-display text-[28px] leading-none font-bold tracking-[-0.03em]">
                {discount.percent}%
              </div>
              <div className="min-w-[180px] grow">
                <div className="flex flex-wrap items-center gap-[8px] font-display text-[17px] font-bold">
                  {discount.name}
                  <span
                    className={`rounded-full px-[12px] font-display text-[12.5px] leading-[26px] font-bold ${
                      active && !expired ? "bg-gold text-ink" : "bg-band text-muted"
                    }`}
                  >
                    {expired ? "Istekao" : active ? "Aktivan" : "Nacrt"}
                  </span>
                </div>
                <div className="text-[14px] text-muted">
                  Kod: {discount.code || "nasumičan za svakog kupca"} ·{" "}
                  {describeTrigger(discount, currency)} · {usage}
                </div>
              </div>
              <form action={toggleDiscountAction}>
                <input type="hidden" name="id" value={discount.id} />
                <button type="submit" className={quietButtonClass}>
                  {active ? "Vrati u nacrt" : "Aktiviraj"}
                </button>
              </form>
              <Link href={`${ADMIN_PATH}/popusti/${discount.id}`} className={quietButtonClass}>
                Izmeni
              </Link>
              <form action={deleteDiscountAction}>
                <input type="hidden" name="id" value={discount.id} />
                <ConfirmButton
                  question={`Obrisati popust „${discount.name}"? Kodovi koji su već poslati kupcima ostaju da važe.`}
                  className={quietButtonClass}
                >
                  Obriši
                </ConfirmButton>
              </form>
            </div>
          );
        })}
        {discounts.length === 0 && (
          <p className="text-[15px] text-muted">
            Još nema popusta. Dok ga ne napravite i aktivirate, nijedan kod ne važi.
          </p>
        )}
      </div>
    </>
  );
}
