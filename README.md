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

Tabele se prave same pri prvom pokretanju. Pri prvom otvaranju `/admin` pravite nalog vlasnika. Na serveru (`npm run start`, Docker) čarobnjak traži i kod za prvo pokretanje, ispisan u dnevniku servera (ili zadat u `SETUP_CODE`), da vlasnik ne postane ko prvi otvori `/admin`; uz `npm run dev` se ne traži. Posle toga se korisnici, uloge i lozinke vode u panelu. (Ako su u `.env.local` upisani `ADMIN_USERNAME` i `ADMIN_PASSWORD`, vlasnik nastaje od njih pri prvoj prijavi.) Ako ostanete bez pristupa: `npm run admin:user -- <ime> <nova-lozinka>`.

Prvo otvorite **Podešavanja**: naziv prodavnice, valuta i zapis iznosa (celi iznosi ili dve decimale), cena dostave, načini plaćanja i email nalog. Zapis iznosa izaberite pre unosa proizvoda.

## Šta je u panelu

| Deo | Šta se tu radi |
|---|---|
| Pregled | prodaja i porudžbine za 30 dana, najprodavaniji proizvodi, gradovi, stvari koje traže pažnju |
| Porudžbine | pretraga, statusi (nova → potvrđena → poslata → isporučena, otkazana) sa emailom kupcu, broj pošiljke, oznaka plaćeno, povraćaj novca i robe, ispravka podataka kupca, istorija, račun u PDF-u, ručni unos porudžbine, izvoz u CSV |
| Kupci | svi kupci sa brojem porudžbina i potrošnjom, istorija porudžbina kupca, beleška o kupcu, izvoz u CSV; izvoz i brisanje podataka kupca na njegov zahtev |
| Napuštene korpe | korpe kupaca koji su upisali email, a nisu poručili; podsetnik emailom (isključen dok ga ne uključite) |
| Poruke | poruke iz kontakt forme prodavnice; novosti: poruka svim prijavljenima, izvoz adresa |
| Utisci | utisci kupaca o proizvodima, sa odobravanjem |
| Izveštaji | prodaja za izabrani period po danima, proizvodima, plaćanju, dostavi i popustima; izvoz u CSV |
| Proizvodi | cena i akcija, šifra, stanje (ručno ili po broju komada) sa istorijom promena, oznaka „pri kraju", slike, opcije i varijante (cena, šifra, stanje i slika po varijanti), slični proizvodi, podaci za pretraživače, nacrt/objavljen, redosled; izmena više proizvoda odjednom; uvoz i izvoz u CSV-u |
| Kategorije, Kolekcije | kategorije sa podkategorijama, proizvod može biti u više njih; kolekcija je ručno složena grupa |
| Popusti | promo kodovi i automatski popusti (procenat, fiksni iznos ili besplatna dostava; cela korpa ili izabrani proizvodi i kategorije; broj korišćenja i rok) i nagrade: kod koji kupac dobija emailom posle porudžbine |
| Stranice | stranice sajta složene od sekcija, sa pregledom pre čuvanja; naslov i opis za pretraživače |
| Blog | članci na `/blog`: naslov, kratak opis, tekst sa naslovima, spiskovima, citatima, linkovima i slikama, naslovna fotografija, autor, oznake, nacrt ili objavljen, zakazana objava, podaci za pretraživače |
| Izgled sajta | boje i fontovi; glavni meni, podnožje, traka sa obaveštenjem; tekstovi i fotografije na stranicama kolekcije, proizvoda, naloga, plaćanja i korpe — sve sa pregledom pre čuvanja |
| Slike | biblioteka ubačenih slika; fotografije se čuvaju kao WebP u više širina |
| Integracije | API ključevi za spoljne sisteme i webhook-ovi (nova porudžbina, status, uplata, povraćaj) |
| Korisnici, Dnevnik, Moj nalog | korisnici panela i uloge (vlasnik, prodaja, sadržaj); ko je i kada šta menjao; sopstvena lozinka, email adresa i prijava u dva koraka kodom iz aplikacije |
| Podešavanja | prodavnica, tema sajta, načini dostave (cena, težina, zone), plaćanje (pouzeće, uplata na račun, kartica uz povezan procesor), povrat (uključen ili isključen), prijava kupaca Google nalogom, račun i PDV, SMTP, poruke o statusu, šablon emaila |

**Zaboravljena lozinka panela.** Na strani za prijavu je link „Zaboravili ste lozinku?": korisnik upiše korisničko ime ili email i dobija link koji važi sat vremena. Za to treba podešen SMTP, upisana adresa sajta (`PUBLIC_URL` ili Podešavanja → Prodavnica → Adresa sajta; adresa iz zahteva se za linkove ne uzima, jer bi je napadač mogao podmetnuti) i email adresa uz korisnika (vlasnik je upisuje pri prvom pokretanju; ostali u delu Moj nalog, ili im je upisuje vlasnik). Bez toga ostaje `npm run admin:user`.

**Prijava kupaca Google nalogom.** Svaka prodavnica upisuje svoje podatke: u Google Cloud konzoli napravite OAuth klijenta (Web application), kao „Authorized redirect URI" upišite `https://vaš-sajt/api/auth/google/callback`, pa Client ID i Client secret prepišite u Podešavanja → Prijava kupaca. Dok su polja prazna, dugme se ne prikazuje.

## Povezivanje sajta

**Javni API je isključen dok ga ne uključite** (panel → Integracije → Pristup spolja); do tada `/api/v1/…` odgovara sa 403. Isto važi, svako za sebe, za API sa ključem i za webhook-ove. Prodavnica koja ide uz panel radi i kada je sve isključeno.

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
| `GET /api/v1/products` · `?category=` `?collection=` `?q=` `?page=` `?limit=` | objavljeni proizvodi, po 100 na strani (`limit` do 250), uz `total`, `page` i `pages`; kategorija obuhvata i svoje podkategorije |
| `GET /api/v1/products/{slug}` | jedan proizvod |
| `GET /api/v1/categories` · `/collections` · `/collections/{id}` | kategorije (sa `parent` za podkategorije) i kolekcije |
| `GET /api/v1/pages` · `/pages/{slug}` | objavljene stranice; stranica ima `sections` (vrsta i sadržaj svake sekcije), i `body` i `images` izvedene iz njih |
| `POST /api/v1/cart` `{ items, discountCode?, deliveryMethod?, postalCode? }` | stavke i obračun: međuzbir, popust, dostava, ukupno; stavka je `{ slug, qty, variant? }`; vraća i načine dostave koji važe za poštanski broj |
| `POST /api/v1/discounts/check` `{ code }` | da li kod važi i šta daje (procenat, iznos ili besplatna dostava); koliko štedi za konkretnu korpu vraća `/cart` |
| `POST /api/v1/orders` `{ customer, items, discountCode?, paymentMethod?, deliveryMethod? }` | upis porudžbine (201) ili greške (422); za karticu vraća `paymentUrl` na koji sajt šalje kupca |

Iznosi u API-ju su celi brojevi u najmanjim jedinicama valute (uz `currency.decimals` iz `/store`): 1250 je 1.250 RSD, odnosno 12,50 € kada valuta ima dve decimale. `shop.formatPrice(iznos, store.currency)` ih ispisuje.

Proizvod sa opcijama (`options`) ima `variants`: po jednu za svaku kombinaciju, sa svojim `id`, cenom (`currentPrice`), dostupnošću (`available`, `maxQty`) i slikom. Takav proizvod ulazi u korpu samo uz `variant` (id varijante); njegov `currentPrice` je najniža cena među varijantama, a `priceVaries` kaže da je treba ispisati kao „od".

Cene, stanje, popust i dostava se uvek računaju u CRM-u; sajt šalje samo šta je u korpi. Kada sajt bude objavljen, upišite njegovu adresu u Podešavanja → Prodavnica → „Sajtovi koji smeju da zovu API".

## Email

Prodavnica šalje poruke (potvrda porudžbine, promena statusa, povraćaj, podsetnik za korpu) preko SMTP naloga koji upišete u Podešavanja → Email o porudžbini. To je nalog vašeg domena, npr. `prodaja@mojsajt.rs` kod hostinga na kom je domen. Dok nije upisan, porudžbine rade normalno, ali poruke ne idu (ni link za novu lozinku kupca); panel to javlja na Pregledu i na stranici porudžbine.

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

### Sadržaj iz panela za sajt van ove aplikacije

Sajt u bilo kojoj tehnologiji može da prikaže ono što vlasnik uređuje u panelu (Stranice, Izgled sajta):

| Poziv | Šta vraća |
|---|---|
| `GET /api/v1/site` | traka sa obaveštenjem, meni, podnožje, boje, fontovi, logo, tekstovi i fotografije stranica kolekcije, proizvoda, naloga, plaćanja i korpe |
| `GET /api/v1/pages/{slug}` | stranica sa sekcijama redom iz uređivača (`sections[n].type` i `data`) |
| `GET /api/v1/blog` · `/blog/{slug}` | objavljeni članci (`?tag=`); članak ima tekst (`body`) i isti tekst razložen na delove (`blocks`) |
| `GET /api/v1/sections` | vrste sekcija i njihova polja |

### Jezici

Podešavanja → Prodavnica: „Jezik sajta i poruka kupcima" i, odvojeno, „Jezik panela" — srpski ili engleski. Pri prvom pokretanju jezik se bira u čarobnjaku.

Jezik sajta menja:

- tekstove teme, poruke o grešci, email kupcu i račun;
- adrese stranica: `/kolekcija` postaje `/collection`, `/placanje` `/checkout`, `/nalog` `/account` (spisak je u `lib/routes.ts`; srpske adrese rade i dalje);
- početni sadržaj: meni, podnožje, početne stranice, tekstove stalnih stranica, email poruke i načine dostave — ali samo tekst koji niste menjali. Ono što ste sami napisali ostaje kako je napisano, kao i nazivi i opisi proizvoda.

Adresa svake stranice iz panela se menja u Stranice → stranica → „Adresa stranice na sajtu".

**Više jezika na sajtu.** U „Dodatni jezici sajta" upišite oznake (`en, de, fr`). Kupac tada bira jezik u zaglavlju sajta, a adrese dodatnih jezika počinju sa `/en`, `/de`. Tekstove prevodite u panelu, deo Prevodi:

| Grupa | Šta se prevodi |
|---|---|
| Tekstovi teme i poruke kupcu | dugmad, natpisi, poruke o grešci, email; za engleski već postoje, za ostale jezike se nudi engleski kao predlog |
| Meni, podnožje, stranice, dostava i email | sve što ste upisali u Stranice, Izgled sajta i Podešavanja |
| Proizvodi, kategorije i kolekcije | nazivi, opisi, opcije |

Dok prevoda nema, prikazuje se tekst na glavnom jeziku. Prevod je vezan za tekst: ako tekst na glavnom jeziku promenite, prevod se upisuje ponovo. Kupac dobija email i račun na jeziku na kom je poručio. Javni API daje sadržaj na drugom jeziku uz `?lang=en`. Panel je na srpskom ili engleskom.

Prevod je u `lib/i18n/` (jezgro, panel, početni sadržaj) i `themes/default/i18n/` (tema): srpski tekst iz koda je ključ, a rečnik jezika ga zamenjuje, pa tekst kog u rečniku nema ostaje na srpskom. Gotov rečnik za nov jezik je nov fajl uz postojeće; adrese na tom jeziku su u `lib/routes.ts`.

### Spoljni sistemi: API sa ključem i webhook-ovi

Za knjigovodstvo, magacin ili kurirsku službu. Prvo se u panelu (Integracije → Pristup spolja) uključe „API sa ključem" i, po potrebi, „Webhook-ovi"; dok su isključeni, ni ispravan ključ ne prolazi i ništa se ne šalje. Ključ se pravi u panelu (Integracije) i šalje u zaglavlju, sa servera — nikad iz koda sajta koji vidi kupac:

```
curl -H "Authorization: Bearer sk_…" https://crm.mojsajt.rs/api/v1/admin/orders?status=new
```

| Poziv | Šta radi |
|---|---|
| `GET /api/v1/admin/orders` | porudžbine, najnovije prve; `?status=`, `?since=` (ISO datum), `?limit=` (do 500) |
| `GET /api/v1/admin/orders/{broj}` | jedna porudžbina |
| `POST /api/v1/admin/orders/{broj}/status` | `{ "status": "confirmed" \| "shipped" \| "delivered" \| "cancelled" \| "new", "notify": false }` — kupac dobija email kao iz panela, osim uz `notify: false` |
| `POST /api/v1/admin/orders/{broj}/tracking` | `{ "number": "RS123", "url": "https://…" }` |
| `GET /api/v1/admin/products` | svi proizvodi, i nacrti, sa brojem komada |
| `POST /api/v1/admin/products/{slug}/stock` | `{ "qty": 12, "variant": "id-varijante" }`; `qty: null` prestaje da vodi broj |

`POST` pozivi traže ključ „Čitanje i izmene".

Webhook šalje `POST` sa telom `{ "event", "at", "data": { "order": … } }` i zaglavljima `X-ShopCRM-Event` i `X-ShopCRM-Signature: sha256=<HMAC-SHA256 tela tajnom webhook-a>`. Događaji: `order.created`, `order.status`, `order.paid`, `order.refunded` (uz `data.amount`), i `ping` za probu iz panela. Odgovor 2xx znači primljeno; inače se pokušava još dva puta (posle 2 i 10 sekundi).

### Docker

```
docker compose up -d
```

pokreće aplikaciju i MariaDB; zatim otvorite `http://localhost:3000/admin` i napravite nalog vlasnika (kod za prvo pokretanje ispisuje `docker compose logs app`). Lozinke baze (`DB_PASSWORD`, `DB_ROOT_PASSWORD`, obavezne) i `PUBLIC_URL` se zadaju u fajlu `.env` pored `docker-compose.yml`. Slike i baza su na Docker diskovima (`uploads`, `db`).

Uz panel ide i gotova javna prodavnica (rute u `app/(shop)/`, izgled u `themes/default`, na adresi `/`). Izgled je tema: folder u `themes/`; može ih biti više, a aktivna se bira u panelu (Podešavanja → Tema sajta), bez diranja panela i jezgra — vidi [themes/README.md](themes/README.md). Čita proizvode, kategorije, popuste i podešavanja direktno iz baze i šalje porudžbine istim putem kao API (`submitOrder`). Stilovi teme su odvojeni od panela.

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
| Nalozi kupaca | tabele `shop_users` i `shop_sessions`; kupac u nalogu vidi porudžbine napravljene dok je bio prijavljen, čuva adresu, preuzima račun i traži povrat |
| Praćenje porudžbine bez naloga, zahtev za povrat | `/pracenje`; zahtevi stižu na stranicu porudžbine u panelu |
| Utisci na stranici proizvoda | Utisci (odobravanje) |
| Traka za kolačiće, Google Analytics, Meta Pixel | Podešavanja → Analitika |

Izabrana varijanta (npr. „Grafit, Orah") stoji uz stavku porudžbine u panelu i u emailu, a stanje se skida sa te varijante.

## Hosting i rezervna kopija

Hosting mora da podržava Node.js aplikacije. Na njemu se prave prazna baza i promenljive iz `.env.example`; `PUBLIC_URL` je javna adresa CRM-a i ulazi u adrese slika i u linkove u emailu. Bez nje (i bez adrese sajta u Podešavanjima) emailovi sa linkom za novu lozinku, podsetnik za korpu i novosti se ne šalju, a kartica se ne pokreće; lokalno, na `localhost`-u, radi i bez toga.

Aplikacija treba da stoji iza proxy-ja (nginx, Cloudflare, proxy hostinga) koji dopisuje adresu posetioca u `X-Forwarded-For`; ograničenje broja pokušaja čita adresu koju je dopisao proxy. Ako ih je više u nizu, njihov broj se upisuje u `TRUSTED_PROXIES`. Prijava u panel i prodavnicu, nova lozinka i praćenje porudžbine imaju i brojač po nalogu, a porudžbine ukupnu granicu (100 za deset minuta), pa ih promena zaglavlja ne zaobilazi.

Ubačene slike su fajlovi u `storage/uploads/` (folder se premešta promenljivom `UPLOADS_DIR`). Taj folder mora da preživi deploy — na hostingu bez trajnog diska slike bi nestale.

Fotografija se pri ubacivanju pretvara u WebP u pet širina (320, 640, 1024, 1600 i do 2400 px); u sadržaju se čuva putanja najveće (`…-full.webp`), a sajt i API nude i manje. Za to je potreban paket `sharp`, koji se instalira uz ostale. SVG, logo i favicon se čuvaju kakvi jesu. Slike ubačene pre ove obrade prevodi skripta:

```bash
npm run images:optimize                    # stari fajlovi ostaju na disku
npm run images:optimize -- --delete-old    # stari fajlovi se brišu
```

```bash
npm run backup   # backups/shopcrm-<datum>.sql i -slike.tar.gz
```

U bazi su lični podaci kupaca, pa kopije ne treba držati na javnom mestu. SMTP lozinka i Google tajna su u bazi šifrovane ključem iz fajla `storage/data.key` (ili promenljive `DATA_KEY`), koji nije u kopiji: čuvajte ga odvojeno. Bez njega se posle vraćanja kopije te dve vrednosti upisuju ponovo u Podešavanjima.

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
| Kupci, podaci na zahtev | `lib/customers.ts`, `lib/privacy.ts` |
| Popusti | `lib/discounts.ts` |
| Zahtevi za povrat, utisci, novosti | `lib/returns.ts`, `lib/reviews.ts`, `lib/newsletter.ts` |
| Izveštaji | `lib/reports.ts` |
| Email | `lib/order-email.ts`, `lib/email-template.ts`, `lib/mail.ts` (ostale poruke) |
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

## Ograničenja

- Proizvod može imati najviše 100 varijanti.
- Plaćanje karticom traži da se dopiše procesor banke (`lib/payments.ts`) i ugovor sa bankom; pouzeće i uplata na račun rade bez toga.
- Račun iz panela (PDF) nije fiskalni račun.
- Katalog se pri svakoj izmeni upisuje ceo (`updateContent`), i panel ga učitava celog; to je dovoljno brzo do nekoliko stotina proizvoda. Prodavnica ga ne učitava: stranica kolekcije, pretraga, slični proizvodi, sekcije i korpa traže iz baze samo proizvode koje prikazuju (`lib/listing.ts`). Pretraga i redosled po nazivu rade nad tekstom na glavnom jeziku.
- Blog nema komentare ni RSS, a tekst članka se piše oznakama (## naslov, **podebljano**), bez vizuelnog uređivača.
- Uz instalaciju stiže jedna tema; druga se dodaje kao folder (themes/README.md).
- Jedan CRM vodi jednu prodavnicu; za drugu se pokreće još jedan, sa svojom bazom.

## Licenca

[AGPL-3.0](LICENSE). Kod smete da koristite, menjate i delite; ako izmenjenu verziju nudite drugima kao servis, morate da objavite i svoje izmene.
