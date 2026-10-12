import { getShopT } from "@/lib/i18n/server";
import Link from "next/link";
import { formatPrice } from "@/lib/storefront/products";
import { NewsletterUnsubscribe, OrderLookup, ResetForm, ResetRequestForm } from "../components/account-extras";
import { RestoreCart, Unsubscribe } from "../components/restore-cart";
import { SimplePage } from "../components/simple-page";
import { DS_STYLE } from "../components/ui";
import { WishlistGrid } from "../components/wishlist";

/** Stranice sa naslovom i jednom formom ili porukom. */

/** /lista-zelja */
export async function WishlistPage() {
  const t = await getShopT();
  return (
    <SimplePage title={t("Lista želja")}>
      <WishlistGrid />
    </SimplePage>
  );
}

/** /pracenje: status porudžbine po broju i email adresi; odavde se podnosi i zahtev za povrat. */
export async function TrackingPage({ number, loggedIn }: { number: string; loggedIn: boolean }) {
  const t = await getShopT();
  return (
    <SimplePage title={t("Praćenje porudžbine")}>
      <p className="lead">{t("Upišite broj porudžbine iz emaila i adresu sa kojom ste poručili.")}</p>
      <OrderLookup number={number} loggedIn={loggedIn} />
    </SimplePage>
  );
}

/** /nalog/lozinka */
export async function ForgotPasswordPage() {
  const t = await getShopT();
  return (
    <SimplePage title={t("Zaboravljena lozinka")}>
      <p className="lead">{t("Upišite email adresu naloga. Poslaćemo vam link na kom postavljate novu lozinku.")}</p>
      <ResetRequestForm />
    </SimplePage>
  );
}

/** /nalog/lozinka/{token}: link iz emaila za novu lozinku. */
export async function NewPasswordPage({ token }: { token: string }) {
  const t = await getShopT();
  return (
    <SimplePage title={t("Nova lozinka")}>
      <ResetForm token={token} />
    </SimplePage>
  );
}

/** /novosti/odjava/{token} */
export async function NewsletterUnsubscribePage({ token }: { token: string }) {
  const t = await getShopT();
  return (
    <SimplePage title={t("Novosti")}>
      <NewsletterUnsubscribe token={token} />
    </SimplePage>
  );
}

/** /korpa/vrati/{token}: vraća sačuvanu korpu i vodi na plaćanje; bez stavki korpa više nije sačuvana. */
export async function RestoreCartPage({ items }: { items: { slug: string; variantId?: string; qty: number }[] }) {
  const t = await getShopT();
  return (
    <SimplePage title={t("Vaša korpa")}>
      {items.length > 0 ? (
        <RestoreCart items={items} />
      ) : (
        <>
          <p className="lead">{t("Ova korpa više nije sačuvana. Proizvode možete ponovo dodati iz kolekcije.")}</p>
          <Link className="btn" href="/kolekcija">{t("Pogledajte kolekciju")}</Link>
        </>
      )}
    </SimplePage>
  );
}

/** /korpa/odjava/{token}: odjava od podsetnika za korpu. */
export async function CartUnsubscribePage({ token }: { token: string }) {
  const t = await getShopT();
  return (
    <SimplePage title={t("Podsetnici za korpu")}>
      <Unsubscribe token={token} />
    </SimplePage>
  );
}

/** /placanje/proba-kartice: stranica probnog procesora kartica, umesto stranice banke. */
export async function TestCardPage({ orderNumber, amount, payUrl, declineUrl }: { orderNumber: string; amount: number; payUrl: string; declineUrl: string }) {
  const t = await getShopT();
  return (
    <div className="ds" style={DS_STYLE}>
      <section style={{ padding: "clamp(48px, 8vw, 120px) 0" }}>
        <div className="wrap" style={{ maxWidth: "620px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="over">{t("Probni procesor")}</div>
            <h1 className="display h-m">{t("Plaćanje porudžbine {broj}", { broj: orderNumber })}</h1>
            <p className="lead">
              {t("Iznos:")} <strong style={{ color: "var(--ink)" }}>{formatPrice(amount)}</strong>{t(". Ovo je proba: ništa se ne naplaćuje.")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <a className="btn gold" href={payUrl}>{t("Uplati")}</a>
              <a className="btn ghost" href={declineUrl}>{t("Odbij uplatu")}</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
