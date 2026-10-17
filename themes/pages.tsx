import type { ComponentProps, JSX, JSXElementConstructor } from "react";
import { cache } from "react";
import { themeId } from "./list";
import { loadTheme, type Theme } from "./registry";

/**
 * Stranice izabrane teme, za rute u app/(shop)/: ruta učita podatke i preda ih stranici, a koja
 * tema je iscrtava odlučuje podešavanje iz panela (Podešavanja → Tema sajta). Samo za server.
 */

/** Id teme iz koda na kojoj je aktivna tema; u pregledu teme iz biblioteke, njena osnova. */
export const getThemeId = cache(async () => {
  // Uvoz pri pozivu: lib/storefront/pages preko prevoda već uvozi ovaj modul.
  const { getPreviewSettings } = await import("@/lib/storefront/pages");
  return themeId((await getPreviewSettings()).themeId);
});

/** Tema koju je vlasnik izabrao. */
export const getTheme = cache(async (): Promise<Theme> => loadTheme(await getThemeId()));

type PageName = { [Key in keyof Theme]: Theme[Key] extends JSXElementConstructor<never> ? Key : never }[keyof Theme];

function themed<Name extends PageName>(name: Name) {
  return async function ThemedPage(props: ComponentProps<Theme[Name]>): Promise<JSX.Element> {
    // Tip svojstava je proveren na potpisu iznad; ovde se samo prosleđuju.
    const Page = (await getTheme())[name] as unknown as (props: object) => JSX.Element;
    return <Page {...(props as object)} />;
  };
}

export const AccountPage = themed("AccountPage");
export const ArticlePage = themed("ArticlePage");
export const BlogPage = themed("BlogPage");
export const CartUnsubscribePage = themed("CartUnsubscribePage");
export const CheckoutPage = themed("CheckoutPage");
export const CollectionPage = themed("CollectionPage");
export const ContentPage = themed("ContentPage");
export const ForgotPasswordPage = themed("ForgotPasswordPage");
export const NewPasswordPage = themed("NewPasswordPage");
export const NewsletterUnsubscribePage = themed("NewsletterUnsubscribePage");
export const NotFoundPage = themed("NotFoundPage");
export const PaymentResultPage = themed("PaymentResultPage");
export const ProductPage = themed("ProductPage");
export const RestoreCartPage = themed("RestoreCartPage");
export const Shell = themed("Shell");
export const TestCardPage = themed("TestCardPage");
export const TrackingPage = themed("TrackingPage");
export const WishlistPage = themed("WishlistPage");
