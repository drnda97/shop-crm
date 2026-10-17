# Teme

Tema je izgled javne prodavnice: raspored stranica, komponente, sekcije i CSS. Jezgro (panel, baza,
obračun korpe, porudžbine, nalozi, email) o izgledu ne zna ništa: rute u `app/(shop)/` učitaju
podatke i predaju ih stranicama teme.

Uz instalaciju može da stoji više tema. Koja je aktivna bira se u panelu: **Podešavanja → Tema
sajta**. Promena važi odmah; proizvodi, stranice, boje, fontovi i podešavanja ostaju isti.

## Nova tema

1. Kopirajte `themes/default` u `themes/moja-tema` i menjajte šta želite.
2. Upišite je u `themes/list.ts` (id, naziv, opis i CSS fajlovi — to vidi panel) i u
   `themes/registry.ts` (red koji učitava njen kod).
3. `npm run build`. Tema se pojavljuje u panelu.

Alias `@theme/*` u `tsconfig.json` i `vitest.config.mts` pokazuje na `themes/default`: jezgro iz
nje uzima samo tipove i početni rečnik, ne izgled.

## Šta tema mora da ima

Jezgro uvozi samo `index.ts` teme; sve ostalo u folderu je njena unutrašnja stvar. `index.ts`
izvozi isto što i `themes/default/index.ts` (TypeScript javlja ako nešto fali):

| Izvoz | Šta je | Ruta |
|---|---|---|
| `dict` | rečnici teme po jeziku (`i18n/`) | sve |
| `Shell` | traka sa obaveštenjem, korpa, merenje poseta | sve |
| `ContentPage` | stranica složena od sekcija | `/`, `/{oznaka}` |
| `NotFoundPage` | stranica koja ne postoji (404) | svaka nepostojeća adresa sajta |
| `CollectionPage` | mreža proizvoda sa filterima (kategorija je filter, `?kategorija=`) | `/kolekcija`, `/kolekcija/{kolekcija}` |
| `ProductPage` | | `/proizvod/{slug}` |
| `BlogPage`, `ArticlePage` | spisak članaka i članak | `/blog`, `/blog/{adresa}` |
| `AccountPage` | | `/nalog` |
| `CheckoutPage` | | `/placanje` |
| `PaymentResultPage` | | `/placanje/uplata` |
| `WishlistPage`, `TrackingPage`, `ForgotPasswordPage`, `NewPasswordPage`, `NewsletterUnsubscribePage`, `RestoreCartPage`, `CartUnsubscribePage`, `TestCardPage` | | ostale |

**Stilovi** su obični CSS fajlovi u folderu teme, navedeni u `themes/list.ts`. Ne uvoze se u kod
(`import "./shop.css"` bi ih učitao i kada tema nije izabrana): jezgro ih služi na
`/api/theme/{id}.css` i link stavlja samo za izabranu temu. Zato u njima nema Sass-a ni
`@import`-a iz `node_modules`; posle izmene u razvoju osvežite stranicu.

**Fontovi** su deo jezgra (`app/(shop)/fonts.ts`, izbor u panelu): tema ih koristi kroz
promenljive `--display` i `--sans`.

Šta svaka stranica dobija piše u njenim tipovima (`ProductPageProps`, `CheckoutPageProps`…).

## Šta tema dobija od jezgra

- **Podaci**: `lib/storefront/*` (proizvodi, podešavanja, stranice, prijavljen kupac), `lib/catalog.ts`, `lib/cart.ts`.
- **Akcije** (`app/(shop)/actions.ts`): obračun korpe, slanje porudžbine, prijava i registracija, kontakt, novosti, utisci, povrat. Tema ih zove; cene, stanje, popust i dostavu uvek računa jezgro.
- **Proizvodi** (`lib/storefront/catalog.ts`, `lib/listing.ts`): prodavnica nikad ne učitava ceo katalog. `CollectionPage` dobija gotov `listing` (filtere, pretragu, redosled i strane računa baza) i izbor kupca upisuje u adresu (`listingSearch`); sekcije traže svoje proizvode sa `getShopList`, a `Shell` dobija samo `upsell`. Korpa i lista želja u pregledaču pamte oznake proizvoda, a podatke traže akcijom `cartProductsAction`.
- **Tekst članka** (`lib/rich-text.ts`): `ArticlePage` dobija tekst već razložen na delove (naslov, pasus, spisak, citat, slika), bez sirovog HTML-a.
- **Sadržaj iz panela**: sekcije stranica (`lib/sections.ts` opisuje vrste i polja), meni i podnožje (`lib/site.ts`), tekstovi stalnih stranica (`lib/templates.ts`), boje i fontovi kao CSS promenljive (`lib/theme.ts`).

Tema mora da ume da prikaže svaku vrstu sekcije iz `lib/sections.ts`; u podrazumevanoj temi to radi
`sections/blocks.tsx`. Nova vrsta sekcije se dodaje na dva mesta: opis polja u `lib/sections.ts`
(da je panel ume da uređuje) i prikaz u temi.

## Sajt potpuno van ove aplikacije

Sajt u bilo kojoj tehnologiji ne treba temu: isti sadržaj čita preko API-ja — `/api/v1/site`
(meni, podnožje, boje, fontovi, tekstovi), `/api/v1/pages/{slug}` (sekcije), `/api/v1/sections`
(vrste sekcija i polja), `/api/v1/products`… Spisak je u glavnom README-u.
