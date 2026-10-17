/**
 * Šta tema daje jezgru: okvir svih stranica, stranice i rečnik. Nova tema ima isti ovakav fajl
 * (themes/README.md). Stilovi se ovde ne uvoze: fajlove navedene u themes/list.ts jezgro služi
 * samo kada je tema izabrana, pa se stilovi dve teme ne mešaju.
 */
export { themeDict as dict } from "./i18n";
export { AccountPage } from "./pages/account";
export { ArticlePage, BlogPage } from "./pages/blog";
export { CheckoutPage } from "./pages/checkout";
export { CollectionPage } from "./pages/collection";
export { ContentPage } from "./pages/content";
export { NotFoundPage } from "./pages/not-found";
export { PaymentResultPage } from "./pages/payment-result";
export { ProductPage } from "./pages/product";
export { Shell } from "./pages/shell";
export {
  CartUnsubscribePage,
  ForgotPasswordPage,
  NewPasswordPage,
  NewsletterUnsubscribePage,
  RestoreCartPage,
  TestCardPage,
  TrackingPage,
  WishlistPage,
} from "./pages/simple";
