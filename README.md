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
| Porudžbine | pretraga, statusi (nova → potvrđena → poslata → isporučena, otkazana) sa emailom kupcu, broj pošiljke, oznaka plaćeno, povraćaj novca i robe, ispravka podataka kupca, istorija, račun u PDF-u, ručni unos porudžbine, izvoz u CSV |
| Kupci | svi kupci sa brojem porudžbina i potrošnjom, istorija porudžbina kupca, beleška o kupcu, izvoz u CSV |
| Napuštene korpe | korpe kupaca koji su upisali email, a nisu poručili; podsetnik emailom (isključen dok ga ne uključite) |
| Poruke | poruke iz kontakt forme prodavnice i adrese prijavljene na novosti |
| Proizvodi | cena i akcija, šifra, stanje (ručno ili po broju komada) sa istorijom promena, oznaka „pri kraju", slike, opcije i varijante (cena, šifra, stanje i slika po varijanti), slični proizvodi, podaci za pretraživače, nacrt/objavljen, redosled; izmena više proizvoda odjednom; uvoz i izvoz u CSV-u |
| Kategorije, Kolekcije | kategorije sa podkategorijama, proizvod može biti u više njih; kolekcija je ručno složena grupa |
| Popusti | promo kodovi (sa brojem korišćenja i rokom) i nagrade: kod koji kupac dobija emailom posle porudžbine |
| Stranice | stranice sajta složene od sekcija, sa pregledom pre čuvanja; naslov i opis za pretraživače |
| Izgled sajta | boje i fontovi; glavni meni, podnožje, traka sa obaveštenjem; tekstovi i fotografije na stranicama kolekcije, proizvoda, naloga, plaćanja i korpe — sve sa pregledom pre čuvanja |
| Slike | biblioteka ubačenih slika; fotografije se čuvaju kao WebP u više širina |
| Podešavanja | prodavnica, načini dostave (cena, težina, zone), plaćanje (pouzeće, uplata na račun, kartica uz povezan procesor), račun i PDV, SMTP, poruke o statusu, šablon emaila |

## Povezivanje sajta

Na sajt se dodaje jedan red, sa adresom na kojoj radi CRM:

```html
<script src="https://crm.mojsajt.rs/sdk.js"></script>
<script>
  const shop = ShopCRM.init();

  const store = await shop.getStore();                 // naziv, valuta, dostava, plaćanja, boje
  const { products } = await shop.getProducts();       // i: { category, collection, q }
  shop.cart.add(products[0].slug, 1);                  // korpa je u pregledaču kupca
  // proizvod sa varijantama: shop.cart.add(slug, 1, product.variants[0].id)
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
| `GET /api/v1/products` · `?category=` `?collection=` `?q=` | objavljeni proizvodi; kategorija obuhvata i svoje podkategorije |
| `GET /api/v1/products/{slug}` | jedan proizvod |
| `GET /api/v1/categories` · `/collections` · `/collections/{id}` | kategorije (sa `parent` za podkategorije) i kolekcije |
| `GET /api/v1/pages` · `/pages/{slug}` | objavljene stranice; stranica ima `sections` (vrsta i sadržaj svake sekcije), i `body` i `images` izvedene iz njih |
| `POST /api/v1/cart` `{ items, discountCode?, deliveryMethod?, postalCode? }` | stavke i obračun: međuzbir, popust, dostava, ukupno; stavka je `{ slug, qty, variant? }`; vraća i načine dostave koji važe za poštanski broj |
| `POST /api/v1/discounts/check` `{ code }` | da li kod važi |
| `POST /api/v1/orders` `{ customer, items, discountCode?, paymentMethod?, deliveryMethod? }` | upis porudžbine (201) ili greške (422); za karticu vraća `paymentUrl` na koji sajt šalje kupca |

Iznosi u API-ju su celi brojevi u najmanjim jedinicama valute (uz `currency.decimals` iz `/store`): 1250 je 1.250 RSD, odnosno 12,50 € kada valuta ima dve decimale. `shop.formatPrice(iznos, store.currency)` ih ispisuje.

Proizvod sa opcijama (`options`) ima `variants`: po jednu za svaku kombinaciju, sa svojim `id`, cenom (`currentPrice`), dostupnošću (`available`, `maxQty`) i slikom. Takav proizvod ulazi u korpu samo uz `variant` (id varijante); njegov `currentPrice` je najniža cena među varijantama, a `priceVaries` kaže da je treba ispisati kao „od".

Cene, stanje, popust i dostava se uvek računaju u CRM-u; sajt šalje samo šta je u korpi. Kada sajt bude objavljen, upišite njegovu adresu u Podešavanja → Prodavnica → „Sajtovi koji smeju da zovu API".

## Email

Prodavnica šalje poruke (potvrda porudžbine, promena statusa, povraćaj, podsetnik za korpu) preko SMTP naloga koji upišete u Podešavanja → Email o porudžbini. To je nalog vašeg domena, npr. `prodaja@mojsajt.rs` kod hostinga na kom je domen. Dok nije upisan, porudžbine rade normalno, ali poruke ne idu; panel to javlja na Pregledu i na stranici porudžbine.

Podsetnici za napuštene korpe se šalju na svakih desetak minuta dok server radi. Na hostingu gde server ne radi stalno, raspored hostinga treba da poziva `/api/v1/cron?key=…`, sa ključem iz promenljive `CRON_SECRET`.

## Plaćanje karticom

Kartica je isključena dok se ne poveže procesor. Sloj je u `lib/payments.ts`: procesor je objekat sa tri funkcije — `ready()` (da li su upisani ključevi), `start()` (vraća adresu stranice banke na koju se kupac šalje) i `confirm()` (čita i proverava potvrdu koju banka pošalje na `/api/v1/payments/{id}`). Nov procesor se dodaje u spisak `PAYMENT_PROVIDERS`, pa se bira u Podešavanja → Plaćanje.

Za proveru toka bez banke postoji probni procesor: `CARD_TEST_PROVIDER=1` u okruženju. Ne naplaćuje ništa i ne sme da ostane uključen na pravoj prodavnici.

## Prelazak sa Shopify-ja ili WooCommerce-a

Proizvodi → Uvoz čita CSV izvoz proizvoda iz obe platforme (i sopstveni izvoz iz ovog panela), prikaže šta će biti dodato i izmenjeno, pa ga upiše: naziv, opis, cene, stanje, kategorije, opcije, varijante i slike. Slike se preuzimaju sa adresa iz fajla i prolaze istu obradu kao ubačene iz panela.

- Shopify: Products → Export → „All products", „Plain CSV file".
- WooCommerce: Products → All Products → Export, sa svim kolonama.

Ne uvoze se utisci, oznake (tagovi), porezi, dostava, kupci ni porudžbine. Proizvod čija oznaka već postoji se menja, pa se isti fajl može uvesti više puta.

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
| Opcije na stranici proizvoda (tkanina, veličina), cena i stanje po varijanti | Proizvodi → Opcije i varijante |
| Tamna traka sa merama na stranici proizvoda | Proizvodi → Istaknuti deo stranice |
| Naziv prodavnice, email, telefon i adresa na stranici Kontakt | Podešavanja → Prodavnica |
| Proizvodi, cene, akcija, slike | Proizvodi (kratak opis je podrazumevana varijanta u korpi) |
| Oznake „Novo" i „Bestseler" na karticama | Kolekcije sa tim oznakama (`novo`, `bestseler`) |
| Načini dostave, cene, prag besplatne dostave, zone, preuzimanje u salonu | Podešavanja → Dostava |
| Načini plaćanja i podaci za uplatu | Podešavanja → Plaćanje |
| Promo kod pri plaćanju | Popusti |
| Kontakt forma i prijava na novosti | Poruke |
| Nalozi kupaca | tabele `shop_users` i `shop_sessions`; kupac u nalogu vidi porudžbine napravljene dok je bio prijavljen |

Izabrana varijanta (npr. „Grafit, Orah") stoji uz stavku porudžbine u panelu i u emailu, a stanje se skida sa te varijante.

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
| Upis porudžbine, kodovi, statistika, istorija porudžbine | `lib/order-store.ts` |
| Načini dostave | `lib/shipping.ts` |
| Procesori kartica | `lib/payments.ts`, `app/api/v1/payments/` |
| Istorija stanja | `lib/stock.ts` |
| Uvoz i izvoz proizvoda | `lib/product-import.ts`, `lib/csv.ts`, `lib/remote-image.ts` |
| Obračun korpe | `lib/cart.ts` |
| Kupci | `lib/customers.ts` |
| Email | `lib/order-email.ts`, `lib/email-template.ts` |
| Račun u PDF-u | `lib/invoice.ts` |
| Napuštene korpe i poslovi po rasporedu | `lib/abandoned.ts`, `instrumentation.ts`, `app/api/v1/cron/` |
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
- Proizvod može imati najviše 100 varijanti.
- Plaćanje karticom traži da se dopiše procesor banke (`lib/payments.ts`) i ugovor sa bankom; pouzeće i uplata na račun rade bez toga.
- Račun iz panela (PDF) nije fiskalni račun.
- Katalog se pri svakoj izmeni upisuje ceo (`updateContent`), što je dovoljno brzo do nekoliko stotina proizvoda.
- Jedan CRM vodi jednu prodavnicu; za drugu se pokreće još jedan, sa svojom bazom.
