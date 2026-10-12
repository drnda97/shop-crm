import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { isAvailable, isVariantAvailable, variantLabel } from "@/lib/catalog";
import { getProducts, getSettings } from "@/lib/content";
import { enabledPayments, paymentLabels } from "@/lib/settings";
import { PageHeader, textLinkClass } from "../../ui";
import { ManualOrderForm } from "./manual-order-form";

export default async function NewOrderPage() {
  await requireAdmin("orders");
  const [products, settings] = await Promise.all([getProducts(), getSettings()]);
  const ordersPath = `${ADMIN_PATH}/porudzbine`;

  return (
    <>
      <Link href={ordersPath} className={textLinkClass}>
        ← Porudžbine
      </Link>
      <div className="mt-[12px]">
        <PageHeader
          title="Nova porudžbina"
          hint="Za porudžbinu primljenu telefonom, porukom ili u radnji. Nude se proizvodi koji mogu da se poruče; cene, popust i dostava se računaju isto kao na sajtu."
        />
      </div>
      <ManualOrderForm
        ordersPath={ordersPath}
        products={products.filter(isAvailable).map((product) => ({
          slug: product.slug,
          name: product.name,
          variants: product.variants
            .filter((variant) => isVariantAvailable(product, variant))
            .map((variant) => ({ id: variant.id, label: variantLabel(variant) })),
        }))}
        methods={settings.shipping.methods.map(({ id, name }) => ({ id, name }))}
        // Kartica traži kupca na stranici procesora, pa se ovde ne nudi.
        payments={enabledPayments(settings).map((id) => ({ id, label: paymentLabels[id] }))}
      />
    </>
  );
}
