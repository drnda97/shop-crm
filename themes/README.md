# Teme

Tema je izgled javne prodavnice: raspored stranica, komponente, sekcije i CSS. Jezgro (panel, baza,
obračun korpe, porudžbine, nalozi, email) o izgledu ne zna ništa: rute u `app/(shop)/` učitaju
podatke i predaju ih stranicama teme.

Aktivnu temu određuje jedan red u `tsconfig.json`:

```json
"@theme/*": ["./themes/default/*"]
```

(i isti red u `vitest.config.mts`). Nova tema: kopirajte `themes/default` u `themes/moja-tema`,
promenite taj red i menjajte šta želite. Posle izmene je potreban `npm run build`.

## Šta tema mora da ima

Rute uvoze samo ovo; sve ostalo u folderu teme je njena unutrašnja stvar.

| Fajl | Izvozi | Ruta |
|---|---|---|
| `shop.css`, `shop-fonts.css` | stilovi | sve |
| `fonts.ts` | `fontVariables` (klase fontova za `<html>`) | sve |
| `pages/shell.tsx` | `Shell` — traka sa obaveštenjem, korpa, merenje poseta | sve |
| `pages/content.tsx` | `ContentPage` — stranica složena od sekcija | `/`, `/{oznaka}` |
| `pages/collection.tsx` | `CollectionPage` | `/kolekcija`, `/kolekcija/{kategorija}` |
| `pages/product.tsx` | `ProductPage` | `/proizvod/{slug}` |
| `pages/account.tsx` | `AccountPage`, tip `Account` | `/nalog` |
| `pages/checkout.tsx` | `CheckoutPage` | `/placanje` |
| `pages/payment-result.tsx` | `PaymentResultPage` | `/placanje/uplata` |
| `pages/simple.tsx` | `WishlistPage`, `TrackingPage`, `ForgotPasswordPage`, `NewPasswordPage`, `NewsletterUnsubscribePage`, `RestoreCartPage`, `CartUnsubscribePage`, `TestCardPage` | ostale |

Šta svaka stranica dobija piše u njenim tipovima (`ProductPageProps`, `CheckoutPageProps`…).

## Šta tema dobija od jezgra

- **Podaci**: `lib/storefront/*` (proizvodi, podešavanja, stranice, prijavljen kupac), `lib/catalog.ts`, `lib/cart.ts`.
- **Akcije** (`app/(shop)/actions.ts`): obračun korpe, slanje porudžbine, prijava i registracija, kontakt, novosti, utisci, povrat. Tema ih zove; cene, stanje, popust i dostavu uvek računa jezgro.
- **Sadržaj iz panela**: sekcije stranica (`lib/sections.ts` opisuje vrste i polja), meni i podnožje (`lib/site.ts`), tekstovi stalnih stranica (`lib/templates.ts`), boje i fontovi kao CSS promenljive (`lib/theme.ts`).

Tema mora da ume da prikaže svaku vrstu sekcije iz `lib/sections.ts`; u podrazumevanoj temi to radi
`sections/blocks.tsx`. Nova vrsta sekcije se dodaje na dva mesta: opis polja u `lib/sections.ts`
(da je panel ume da uređuje) i prikaz u temi.

## Sajt potpuno van ove aplikacije

Sajt u bilo kojoj tehnologiji ne treba temu: isti sadržaj čita preko API-ja — `/api/v1/site`
(meni, podnožje, boje, fontovi, tekstovi), `/api/v1/pages/{slug}` (sekcije), `/api/v1/sections`
(vrste sekcija i polja), `/api/v1/products`… Spisak je u glavnom README-u.
