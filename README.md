# ShopCRM

Admin panel i API za internet prodavnicu, bez Shopify-a i WooCommerce-a. CRM je odvojen od sajta: u panelu se vode proizvodi, porudžbine i kupci, a sajt prodavnice — bilo koji, u bilo kojoj tehnologiji — čita proizvode i šalje porudžbine preko API-ja.

Next.js (App Router), TypeScript, Tailwind CSS, MySQL ili MariaDB. Bez plaćenih servisa.

## Pokretanje

Potreban je Node.js 20 ili noviji i prazna MySQL baza.

```bash
cp .env.example .env.local   # pa upišite lozinku za panel i podatke baze
npm install
npm run dev                  # http://localhost:3000/admin
npm run build && npm run start
```

Tabele se prave same pri prvom pokretanju. Prijava u panel je jednim nalogom iz `.env.local` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`).

Prvo otvorite **Podešavanja**: naziv prodavnice, valuta i zapis iznosa (celi iznosi ili dve decimale), cena dostave, načini plaćanja i email nalog. Zapis iznosa izaberite pre unosa proizvoda.

## Šta je u panelu

| Deo | Šta se tu radi |
|---|---|
| Pregled | prodaja i porudžbine za 30 dana, najprodavaniji proizvodi, gradovi, stvari koje traže pažnju |
| Porudžbine | pretraga, statusi (nova → potvrđena → poslata → isporučena, otkazana), beleška uz porudžbinu, izvoz u CSV |
| Kupci | svi kupci sa brojem porudžbina i potrošnjom, istorija porudžbina kupca, beleška o kupcu, izvoz u CSV |
| Poruke | poruke iz kontakt forme prodavnice i adrese prijavljene na novosti |
| Proizvodi | cena i akcija, šifra, stanje (ručno ili po broju komada), oznaka „pri kraju", slike, opcije koje kupac bira, istaknuti deo stranice, nacrt/objavljen, redosled |
| Kategorije, Kolekcije | kategorija je jedna po proizvodu; kolekcija je ručno složena grupa |
| Popusti | promo kodovi (sa brojem korišćenja i rokom) i nagrade: kod koji kupac dobija emailom posle porudžbine |
| Stranice | stranice sajta složene od sekcija, sa pregledom pre čuvanja; naslov i opis za pretraživače |
| Izgled sajta | boje i fontovi; glavni meni, podnožje, traka sa obaveštenjem; tekstovi i fotografije na stranicama kolekcije, proizvoda, naloga, plaćanja i korpe — sve sa pregledom pre čuvanja |
| Slike | biblioteka ubačenih slika; fotografije se čuvaju kao WebP u više širina |
| Podešavanja | prodavnica, izgled emaila, dostava, plaćanje (pouzeće, uplata na račun), SMTP, šablon emaila |

## Povezivanje sajta

Na sajt se dodaje jedan red, sa adresom na kojoj radi CRM:

```html
<script src="https://crm.mojsajt.rs/sdk.js"></script>
<script>
  const shop = ShopCRM.init();

  const store = await shop.getStore();                 // naziv, valuta, dostava, plaćanja, boje
  const { products } = await shop.getProducts();       // i: { category, collection, q }
  shop.cart.add(products[0].slug, 1);                  // korpa je u pregledaču kupca
  const { lines, pricing } = await shop.cart.price();  // obračun sa servera

  const result = await shop.placeOrder({
    customer: { name, phone, email, street, city, postalCode, note },
    paymentMethod: "cod",                              // ili "bank"
  });
  // { ok: true, orderNumber, total } ili { ok: false, errors: { phone: "…" }, message }
</script>
```

Radni primer je `public/demo.html` (na pokrenutom CRM-u: `/demo.html`) — cela prodavnica sa korpom i poručivanjem u jednom fajlu.

Sajt koji ne koristi `sdk.js` (npr. server u PHP-u ili Next.js-u) zove API direktno:

| Poziv | Šta vraća |
|---|---|
| `GET /api/v1/store` | podaci prodavnice i linkovi za podnožje |
| `GET /api/v1/products` · `?category=` `?collection=` `?q=` | objavljeni proizvodi |
| `GET /api/v1/products/{slug}` | jedan proizvod |
| `GET /api/v1/categories` · `/collections` · `/collections/{id}` | kategorije i kolekcije |
| `GET /api/v1/pages` · `/pages/{slug}` | objavljene stranice; stranica ima `sections` (vrsta i sadržaj svake sekcije), i `body` i `images` izvedene iz njih |
| `POST /api/v1/cart` `{ items, discountCode? }` | stavke i obračun: međuzbir, popust, dostava, ukupno |
| `POST /api/v1/discounts/check` `{ code }` | da li kod važi |
| `POST /api/v1/orders` `{ customer, items, discountCode?, paymentMethod? }` | upis porudžbine (201) ili greške (422) |

Iznosi u API-ju su celi brojevi u najmanjim jedinicama valute (uz `currency.decimals` iz `/store`): 1250 je 1.250 RSD, odnosno 12,50 € kada valuta ima dve decimale. `shop.formatPrice(iznos, store.currency)` ih ispisuje.

Cene, stanje, popust i dostava se uvek računaju u CRM-u; sajt šalje samo šta je u korpi. Kada sajt bude objavljen, upišite njegovu adresu u Podešavanja → Prodavnica → „Sajtovi koji smeju da zovu API".

## Demo prodavnica

Uz panel ide i gotova javna prodavnica (`app/(shop)/`, na adresi `/`). Čita proizvode, kategorije, popuste i podešavanja direktno iz baze i šalje porudžbine istim putem kao API (`submitOrder`). Ima sopstveni izgled (`app/(shop)/shop.css`), odvojen od panela.

```bash
npm run seed:demo   # 11 proizvoda iz dizajna, kategorije, oznake, kod DOBRODOSLI10, dostava i plaćanje
```

Skripta dodaje samo ono čega nema, pa postojeći sadržaj ne dira.

| U prodavnici | Odakle dolazi u panelu |
|---|---|
| Početna, O nama, Pitanja, Kontakt i ostale stranice | Stranice (sekcije); pri prvom pokretanju dobijaju sadržaj iz dizajna |
| Boje i fontovi | Izgled sajta → Tema |
| Meni, podnožje, traka sa obaveštenjem | Izgled sajta → Meni i podnožje |
| Tekstovi i fotografije kolekcije, proizvoda, naloga, plaćanja i korpe | Izgled sajta |
| Opcije na stranici proizvoda (tkanina, veličina) i tamna traka sa merama | Proizvodi → Opcije, Istaknuti deo stranice |
| Naziv prodavnice, email, telefon i adresa na stranici Kontakt | Podešavanja → Prodavnica |
| Proizvodi, cene, akcija, slike | Proizvodi (kratak opis je podrazumevana varijanta u korpi) |
| Oznake „Novo" i „Bestseler" na karticama | Kolekcije sa tim oznakama (`novo`, `bestseler`) |
| Dostava, prag besplatne dostave, preuzimanje u salonu | Podešavanja → Dostava |
| Načini plaćanja i podaci za uplatu | Podešavanja → Plaćanje |
| Promo kod pri plaćanju | Popusti |
| Kontakt forma i prijava na novosti | Poruke |
| Nalozi kupaca | tabele `shop_users` i `shop_sessions`; kupac u nalogu vidi porudžbine napravljene dok je bio prijavljen |

Opcije koje kupac izabere (npr. tkanina i postolje) idu u napomenu porudžbine. Cena i stanje su isti za sve opcije jednog proizvoda.

## Hosting i rezervna kopija

Hosting mora da podržava Node.js aplikacije. Na njemu se prave prazna baza i promenljive iz `.env.example`; `PUBLIC_URL` je javna adresa CRM-a i ulazi u adrese slika.

Ubačene slike su fajlovi u `storage/uploads/` (folder se premešta promenljivom `UPLOADS_DIR`). Taj folder mora da preživi deploy — na hostingu bez trajnog diska slike bi nestale.

Fotografija se pri ubacivanju pretvara u WebP u pet širina (320, 640, 1024, 1600 i do 2400 px); u sadržaju se čuva putanja najveće (`…-full.webp`), a sajt i API nude i manje. Za to je potreban paket `sharp`, koji se instalira uz ostale. SVG, logo i favicon se čuvaju kakvi jesu. Slike ubačene pre ove obrade prevodi skripta:

```bash
npm run images:optimize                    # stari fajlovi ostaju na disku
npm run images:optimize -- --delete-old    # stari fajlovi se brišu
```

```bash
npm run backup   # backups/shopcrm-<datum>.sql i -slike.tar.gz
```

U bazi su lični podaci kupaca i lozinka email naloga, pa kopije ne treba držati na javnom mestu.

## Raspored koda

| Šta | Gde |
|---|---|
| Tabele baze | `lib/db.ts` (polazna šema), `lib/migrations.ts` (kasnije izmene) |
| Čitanje i izmena sadržaja, slike | `lib/content.ts` |
| Upis porudžbine, kodovi, statistika | `lib/order-store.ts` |
| Obračun korpe | `lib/cart.ts` |
| Kupci | `lib/customers.ts` |
| Email | `lib/order-email.ts`, `lib/email-template.ts` |
| Javni API | `app/api/v1/[...path]/route.ts`, `lib/api.ts` |
| Panel | `app/(crm)/admin/` (sve izmene idu kroz `app/(crm)/admin/actions.ts`) |
| Vrste sekcija i opis njihovih polja | `lib/sections.ts`; izgled u temi: `app/(shop)/_sections/` |
| Meni i podnožje, polja teme | `lib/site.ts` |
| Boje i fontovi teme | `lib/theme.ts`, `app/(shop)/shop.css`, `app/(shop)/fonts.ts` |
| Tekstovi stranica sa stalnim rasporedom | `lib/templates.ts` |
| Obrada slika i njihove veličine | `lib/images.ts`, `lib/media.ts` |
| Pregled nesačuvanih izmena na sajtu | `lib/storefront/pages.ts`, `proxy.ts` |
| Početni sadržaj stranica | `lib/default-pages.ts` |
| Demo prodavnica | `app/(shop)/`, `lib/storefront/`, `scripts/seed-demo.mjs` |
| Veza za sajt | `public/sdk.js`, primer `public/demo.html` |
| Testovi | `tests/` (`npm test`) |

Plan razvoja je u `PLAN.md`.

## Ograničenja

- Natpisi na dugmadima i poljima formi prodavnice su u temi, na srpskom.
- Jedan nalog za panel; nema uloga ni više korisnika.
- Opcije proizvoda (veličina, boja) nemaju svoju cenu ni stanje: varijanta sa drugom cenom se vodi kao zaseban proizvod.
- Nema plaćanja karticom. Za to je potreban ugovor sa bankom ili procesorom; pouzeće i uplata na račun rade bez toga.
- Katalog se pri svakoj izmeni upisuje ceo (`updateContent`), što je dovoljno brzo do nekoliko stotina proizvoda.
- Jedan CRM vodi jednu prodavnicu; za drugu se pokreće još jedan, sa svojom bazom.
