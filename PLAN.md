# Plan razvoja

## Cilj

ShopCRM treba da zameni Shopify i WordPress + WooCommerce za malu i srednju prodavnicu: bez mesečne pretplate, na sopstvenom hostingu. Prvo se koristi za prodavnice bliskih ljudi, a kada bude završen izlazi kao otvoren kod na GitHub-u, da ga može koristiti bilo ko.

Merilo da je gotovo: vlasnik prodavnice koji ne zna da programira može da postavi prodavnicu, promeni svaku stranicu i sekciju sajta, vodi proizvode i porudžbine i naplati karticom, a da ne otvori kod.

## Gde smo sada

Radi: proizvodi, kategorije, kolekcije, porudžbine sa statusima, kupci, poruke, promo kodovi i nagrade, email potvrde, pouzeće i uplata na račun, javni API i `sdk.js`, demo prodavnica sa korpom, plaćanjem i nalozima kupaca.

Od Faze 1 se iz panela menjaju i stranice sajta, meni i podnožje, boje i fontovi, i tekstovi na stranicama kolekcije, proizvoda, naloga, plaćanja i korpe. U temi su još natpisi na dugmadima i poljima formi.

## Poređenje

| Oblast | Shopify | WooCommerce | ShopCRM danas |
|---|---|---|---|
| Izmena stranica i sekcija bez koda | da (sekcije i blokovi) | da (Gutenberg, builderi) | ne |
| Meniji, zaglavlje, podnožje | da | da | u kodu |
| Biblioteka slika | da | da | samo slike uz proizvod i stranicu |
| Blog | da | da | ne |
| SEO (naslov, opis, sitemap, preusmerenja) | da | dodatak | samo naslov stranice proizvoda |
| Varijante (veličina, boja) | da | da | ne |
| Filteri, podkategorije | da | da | jedna kategorija, bez filtera |
| Uvoz i izvoz proizvoda (CSV) | da | da | samo izvoz porudžbina i kupaca |
| Plaćanje karticom | da | dodatak | ne |
| Zone i cenovnik dostave, kurirske službe | da | da / dodatak | jedna cena i prag za besplatnu |
| PDV, račun u PDF-u | da | da / dodatak | ne |
| Povraćaj, izmena porudžbine, ručna porudžbina | da | da | samo otkazivanje |
| Napuštena korpa | da | dodatak | ne |
| Utisci kupaca, lista želja | aplikacija | da / dodatak | ne |
| Vrste popusta | procenat, iznos, dostava, po proizvodu | isto | samo procenat na celu korpu |
| Nalog kupca: zaboravljena lozinka, adrese | da | da | prijava i spisak porudžbina |
| Više korisnika panela, uloge | da | da | jedan nalog iz `.env` |
| Analitika, GA4 / Meta Pixel, saglasnost za kolačiće | da | dodatak | pregled prodaje za 30 dana |
| Postavljanje bez programera | nije potrebno | instalater | ručno: `.env`, baza, `npm` |
| Proširenja (webhook, dodaci, teme) | da | da | javni API za čitanje i poručivanje |

## Predlog redosleda

### Faza 0 — Učvrstiti postojeće ✅

Završeno 11. 10. 2026.

- Trenutno stanje je u gitu.
- Migracije baze (`lib/migrations.ts`): tabele iz `lib/db.ts` su polazna šema, svaka kasnija izmena je numerisana migracija koja se izvrši sama pri pokretanju.
- Testovi (`npm test`) za cene i stanje, obračun korpe, popuste, proveru podataka porudžbine, ograničenje pokušaja i migracije.
- Ograničenje pokušaja je na jednom mestu (`lib/rate-limit.ts`) i sada pokriva i prijavu u panel i proveru koda preko API-ja.

Ostalo za kasnije: test upisa porudžbine u bazu (`submitOrder`) traži probnu bazu, pa ide uz Fazu 3, kada se taj deo menja.

### Faza 1 — Ceo sajt se uređuje iz panela

Prvi deo završen 11. 10. 2026.

Urađeno:

- **Sekcije** (`lib/sections.ts`, izgled u `app/(shop)/_sections/`): 16 vrsta — glavni baner, prednosti, pločice, proizvodi, tekst sa slikom, baner, utisci, novosti, naslov stranice, fotografija, tekst, kartice, koraci, pitanja, poziv, kontakt. Vrsta sekcije je opis polja; panel iz njega pravi formu.
- **Uređivač stranice** (Stranice → Izmeni): dodavanje, brisanje i pomeranje sekcija, forma levo, pregled sajta desno. Pregled prati izmene dok se kuca, a kupci ih vide tek posle „Sačuvaj".
- **Stranice**: početna, o nama, pitanja i kontakt su sada stranice iz baze, sa sadržajem iz dizajna. Nova stranica dobija adresu `/{oznaka}` i nastaje kao nacrt. Uslovi kupovine, povrat i privatnost dolaze kao nacrti sa mestima za dopunu.
- **Izgled sajta**: glavni meni, kolone podnožja, opis prodavnice, traka sa obaveštenjem. Naziv prodavnice u zaglavlju, podnožju i naslovima stranica je iz Podešavanja.
- **Slike**: biblioteka svih ubačenih slika, izbor postojeće slike u svakoj sekciji, zaštita od brisanja slike koja je na sajtu.
- **SEO**: naslov i opis po stranici, `sitemap.xml`, `robots.txt`, podaci o proizvodu za Google (schema.org), kanonske adrese.

Drugi deo završen 12. 10. 2026.

- **Tema** (Izgled sajta → Tema, `lib/theme.ts`): četiri boje i dva fonta od devet ponuđenih. Tema više nema upisane boje: sve idu kroz promenljive u `app/(shop)/shop.css`, a nijanse i boju teksta na dugmadima i tamnim sekcijama sajt računa iz izabrane palete. Iste boje važe i za email.
- **Tekstovi stranica sa stalnim rasporedom** (Izgled sajta → Kolekcija, Proizvod, Nalog kupca, Plaćanje, Korpa; `lib/templates.ts`), sa pregledom kao i stranice.
- **Proizvod**: opcije koje kupac bira (bez posebne cene i stanja) i istaknuti deo stranice (naslov, tekst, mere, fotografija) upisuju se uz proizvod. Izmišljene tkanine, postolja, mere i rezervni tekstovi iz dizajna su izbačeni; slični proizvodi su iz iste kategorije.
- **Slike** (`lib/images.ts`, `lib/media.ts`): fotografija se pri ubacivanju pretvara u WebP u pet širina (320, 640, 1024, 1600 i do 2400 px), a sajt i panel sami biraju odgovarajuću. SVG se čuva kakav jeste. `npm run images:optimize` obrađuje slike ubačene ranije.

Ostalo:

- Natpisi na dugmadima i poljima formi („Dodaj u korpu", „Email adresa") su u temi; idu uz prevod u Fazi 6.
- Zaobljenost i razmaci teme se ne menjaju iz panela.
- SEO polja za proizvod i kategoriju, slika za deljenje po stranici, preusmerenja starih adresa.

### Faza 2 — Katalog ✅

Završeno 12. 10. 2026.

- **Varijante** (`lib/catalog.ts`, tabela `product_variants`): svaka kombinacija opcija je varijanta sa svojom cenom i akcijom, šifrom, brojem komada i slikom; kombinacija koja se ne pravi se isključuje. Bez sopstvene cene važi cena proizvoda. Najviše 100 varijanti po proizvodu. Varijanta prolazi kroz ceo tok: stranica proizvoda, korpa, obračun, skidanje sa stanja, porudžbina u panelu, email, izvoz, API i `sdk.js`. Oznaka „pri kraju" i pregled stanja u panelu gledaju stanje po varijanti.
- **Kategorije**: podkategorije na bilo kojoj dubini, proizvod u više kategorija (jedna glavna), stranica svake kategorije na `/kolekcija/{oznaka}` sa svojim tekstom i podacima za pretraživače. Proizvod iz podkategorije vidi se i u nadkategoriji.
- **Filteri i sortiranje** na stranici kolekcije: po ceni i po vrednostima opcija, sortiranje po ceni i nazivu.
- **Uvoz i izvoz proizvoda** (`lib/product-import.ts`, Proizvodi → Uvoz / Izvoz): CSV izvoz iz Shopify-ja i WooCommerce-a i sopstveni izvoz, sa pregledom pre upisa; kategorije, opcije, varijante i slike. Slike se preuzimaju samo sa javnih adresa.
- **Izmena više proizvoda odjednom**: objava, nacrt, kategorija, cena za procenat, brisanje.
- **Slični proizvodi** se biraju uz proizvod; ostatak se dopunjuje iz iste kategorije.
- **Istorija stanja** (`lib/stock.ts`, tabela `stock_log`): porudžbina, otkazivanje, izmena u panelu i uvoz ostavljaju trag, vidljiv u formi proizvoda. Otkazivanje vraća komade na stanje varijante.
- **SEO polja** za proizvod i kategoriju.

Ostalo za kasnije:

- Uvoz ne prenosi utiske, oznake (tagove), poreze ni dostavu, i ne čita Shopify-jev i WooCommerce-ov izvoz kupaca i porudžbina.
- Katalog se pri svakoj izmeni prepisuje ceo, i panel ga učitava celog; za više hiljada proizvoda upis treba svesti na izmenjeni proizvod, a spiskove u panelu na strane. (Prodavnica od 13. 10. 2026. čita samo proizvode koje prikazuje.)

### Faza 3 — Porudžbine, plaćanje, dostava

Prvi deo završen 12. 10. 2026.

- **Načini dostave** (`lib/shipping.ts`, Podešavanja → Dostava): više načina, svaki sa cenom (stalnom ili po težini), pragom za besplatnu dostavu, zonom po poštanskim brojevima i rečenicom posle porudžbine. Lično preuzimanje je jedan od načina. Podešavanja iz prve verzije se prevode sama.
- **Plaćanje karticom** (`lib/payments.ts`): opcija u Podešavanja → Plaćanje, isključena po podrazumevanom. Zajednički sloj za procesore: pokretanje plaćanja, povratak kupca i potvrda na `/api/v1/payments/{id}`. Dok nijedan procesor nije povezan, kartica se ne nudi kupcu. Uz kod ide probni procesor (`CARD_TEST_PROVIDER=1`) koji ne naplaćuje ništa i služi da se tok proveri.
- **Stranica porudžbine** u panelu: broj pošiljke i adresa za praćenje, oznaka plaćeno, evidencija povraćaja (ceo ili delimičan), ispravka podataka kupca, istorija događaja.
- **Poruke o statusu**: email kupcu kada porudžbina postane potvrđena, poslata, isporučena ili otkazana, sa tekstovima koji se menjaju u panelu i brojem pošiljke.
- **Ručna porudžbina** iz panela, sa istim proverama kao porudžbina sa sajta.
- **PDV i račun** (`lib/invoice.ts`): stopa i podaci firme u Podešavanjima; račun porudžbine u PDF-u, sa osnovicom i PDV-om. Preuzima se iz porudžbine u panelu i iz naloga kupca, a kupcu po izboru stiže u prilogu emaila (uz potvrdu porudžbine ili uz poruku da je poslata).
- **Povraćaj**: iznos (ceo ili delimičan) i vraćeni komadi po stavci; vraćeni komadi idu na stanje, kupac dobija email, a procesor kartica koji to ume vraća novac na karticu. Otkazivanje posle povraćaja ne vraća iste komade dva puta.
- **Napuštena korpa** (`lib/abandoned.ts`, panel → Napuštene korpe): email upisan na stranici plaćanja pamti korpu; posle zadatog broja sati kupac dobija jedan podsetnik sa linkom koji mu vraća korpu i linkom za odjavu. Isključeno dok ga vlasnik ne uključi. Šalje se na svakih desetak minuta dok server radi (`instrumentation.ts`), ili pozivom `/api/v1/cron?key=CRON_SECRET` na hostingu gde server ne radi stalno.
- **Email nije povezan**: panel to javlja na Pregledu, na stranici porudžbine i uz napuštene korpe, sa linkom na Podešavanja. Svaka prodavnica upisuje SMTP nalog svog domena.

Odlučeno 12. 10. 2026: stavke postojeće porudžbine se ne menjaju (nema izmene proizvoda posle poručivanja).

Ostalo:

- Procesor kartica: nijedan pravi nije dopisan. Dopisuje se kada prva prodavnica dobije ugovor sa bankom.
- Zahtev za povrat koji kupac sam podnosi iz naloga, i povraćaj kao kod za sledeću kupovinu umesto novca: nije urađeno, čeka odluku.
- Račun nije fiskalni račun.
- Zone su po poštanskim brojevima jedne zemlje; dostava u više zemalja traži polje za zemlju pri poručivanju.
- Test upisa porudžbine u bazu (`submitOrder`) i dalje ne postoji; tok je proveren u pregledaču.

### Faza 4 — Kupci i marketing ✅

Završeno 12. 10. 2026.

- **Popusti** (`lib/discounts.ts`): procenat, fiksni iznos ili besplatna dostava; na celu korpu ili samo na izabrane proizvode i kategorije; najmanji iznos korpe; automatski popust bez koda. Kada važe i kod kupca i automatski popust, primenjuje se onaj koji kupcu više štedi (ne sabiraju se). Obračun na stranici plaćanja radi server.
- **Nalog kupca**: zaboravljena lozinka (link emailom, važi sat vremena i jednom), adresa za dostavu uz nalog koja popunjava plaćanje, brisanje naloga. Dugme za prijavu Google nalogom, koje nije radilo, je uklonjeno.
- **Praćenje porudžbine** bez naloga (`/pracenje`): po broju i email adresi.
- **Zahtev za povrat** (`lib/returns.ts`): kupac sa stranice za praćenje bira šta vraća i zašto; prodavac na stranici porudžbine odobrava ili odbija, a kupac odgovor dobija emailom. Povraćaj novca se zatim upisuje na istoj stranici.
- **Utisci** (`lib/reviews.ts`, panel → Utisci): piše ih prijavljen kupac, vide se posle odobrenja; ocena ulazi u podatke za Google.
- **Lista želja**: čuva se u pregledaču, kao korpa.
- **Novosti** (`lib/newsletter.ts`): poruka svim prijavljenima iz panela, sa linkom za odjavu; izvoz adresa u CSV.
- **Izveštaji** (`lib/reports.ts`, panel → Izveštaji): prodaja za izabrani period po danima, proizvodima, načinima plaćanja i dostave i popustima; izvoz u CSV.
- **Analitika**: Google Analytics 4 i Meta Pixel, učitavaju se tek uz pristanak u traci za kolačiće. Bez upisanih oznaka nema ni trake ni kolačića za praćenje.
- **Podaci kupca na zahtev** (`lib/privacy.ts`): izvoz svega što se čuva o kupcu, i brisanje (porudžbine ostaju bez imena, kontakta i adrese).

Ostalo:

- Lista želja nije vezana za nalog: na drugom uređaju je prazna.
- Utisak može da ostavi samo prijavljen kupac; kupac bez naloga ne može.
- Nagrade posle porudžbine su i dalje samo procenat na celu korpu. (Popusti se namerno ne sabiraju: vidi Odluke.)
- Meta Pixel nije isproban sa pravim nalogom; Google Analytics je proveren samo do učitavanja skripte.
- Novosti idu preko SMTP naloga prodavnice, poruku po poruku; za spiskove od više hiljada adresa treba servis za slanje.
- Povraćaj kao kod za sledeću kupovinu umesto novca nije urađen.

### Faza 5 — Panel za više ljudi ✅

Završeno 12. 10. 2026.

- **Korisnici u bazi** (`lib/admin-auth.ts`, tabele `admin_users` i `admin_sessions`; panel → Korisnici): svako ima svoje ime i lozinku. `ADMIN_USERNAME` i `ADMIN_PASSWORD` iz `.env.local` služe samo dok je baza prazna: pri prvoj prijavi od njih nastaje nalog vlasnika. Prijava je sesija u bazi, pa isključivanje korisnika ili nova lozinka odmah odjavljuju njegove uređaje.
- **Uloge**: vlasnik (sve), prodaja (porudžbine, kupci, korpe, poruke, utisci, izveštaji, proizvodi, popusti), sadržaj (stranice, izgled sajta, slike, proizvodi). Podešavanja, Korisnici i Dnevnik su samo za vlasnika. Uloga se proverava na svakoj stranici, akciji i ruti za izvoz, ne samo u meniju. Poslednji aktivan vlasnik ne može biti obrisan, isključen ni prebačen u drugu ulogu.
- **Dnevnik izmena** (`lib/audit.ts`, tabela `audit_log`; panel → Dnevnik): ko je, kada i šta uradio, uključujući prijave. Čuva se šest meseci.
- **Prijava u dva koraka** (`lib/totp.ts`; panel → Moj nalog): kod iz aplikacije na telefonu (TOTP), podešava se skeniranjem QR koda; osam rezervnih kodova, svaki za jednu prijavu. Vlasnik je može isključiti korisniku koji je ostao bez telefona.
- **Moj nalog**: promena sopstvene lozinke, koja odjavljuje ostale uređaje.
- **Povratak pristupa**: `npm run admin:user -- <ime> <nova-lozinka>` na serveru postavlja lozinku, vraća ulogu vlasnika i isključuje dva koraka.
- Žetoni za pregled izmena na sajtu i probno plaćanje više se ne potpisuju lozinkom panela, već tajnom servera (`APP_SECRET`, ili ona koju server sam napravi i čuva u bazi).

Ostalo:

- Uloge su tri i zadate u kodu; nema sopstvenih uloga ni dozvola po stavci.
- Dnevnik beleži šta je urađeno i na čemu, ne i staru i novu vrednost. Beleške i pomeranje redosleda se ne upisuju.
- Prijava u dva koraka je po izboru korisnika; vlasnik ne može da je zahteva od svih.
- Isti kod iz aplikacije može se upotrebiti dva puta dok važi (oko minut).

### Faza 6 — Objavljivanje kao otvoren kod (u toku)

Urađeno 12. 10. 2026:

- **Prvo pokretanje**: na praznoj bazi `/admin` nudi pravljenje naloga vlasnika i upis naziva prodavnice; `ADMIN_USERNAME` i `ADMIN_PASSWORD` više nisu obavezni. Ko prvi otvori `/admin` na novoj instalaciji postaje vlasnik, pa to treba uraditi odmah po postavljanju.
- **API ključevi i API za spoljne sisteme** (`lib/integrations.ts`, `/api/v1/admin`; panel → Integracije): čitanje porudžbina i proizvoda, promena statusa, broj pošiljke, upis stanja. Ključ je samo za čitanje ili i za izmene; u bazi se čuva njegov heš.
- **Webhook-ovi**: nova porudžbina, promena statusa, uplata, povraćaj. Poruka je potpisana (HMAC-SHA256), tri pokušaja, ishod poslednjeg slanja se vidi u panelu, uz dugme za probu.
- **Docker**: `Dockerfile` i `docker-compose.yml` (aplikacija i MariaDB).
- **CI** (`.github/workflows/ci.yml`): lint, tipovi, testovi i build na svaki push.
- `.env.example` je sada u gitu (bio je izostavljen pravilom `.env*`).

- **Licenca**: AGPL-3.0 (`LICENSE`).
- **Tema odvojena od jezgra** (`themes/default`, `themes/README.md`): izgled prodavnice je jedan folder; rute u `app/(shop)/` samo učitaju podatke i predaju ih stranicama teme. Aktivnu temu bira jedan red u `tsconfig.json`. Šta tema mora da ima piše u `themes/README.md`.
- **Sadržaj kroz API**: `/api/v1/site` (traka, meni, podnožje, boje, fontovi, tekstovi stalnih stranica) i `/api/v1/sections` (vrste sekcija i polja), uz postojeći `/api/v1/pages/{slug}`. Sajt van ove aplikacije tako koristi uređivač iz panela.
- **Jezici** (`lib/i18n`): tekstovi u kodu su na srpskom i ujedno ključ prevoda, a rečnik drugog jezika ih zamenjuje; nepreveden tekst ostaje na srpskom. Podešavanja → Prodavnica bira jezik sajta i, odvojeno, jezik panela. Na engleskom su: sve stranice teme, poruke o grešci, statusi i načini plaćanja, naslovi stranica, email kupcu (porudžbina, status, napuštena korpa, novosti, nova lozinka), račun u PDF-u i ceo panel (stranice, poruke akcija, dnevnik, nazivi polja i sekcija u uređivaču). Rečnici: `lib/i18n/shop.ts` (jezgro, ono što vidi kupac), `lib/i18n/panel-en-*.ts` (panel) i `themes/default/i18n/en.ts` (tema).
- **Adrese stranica na jeziku sajta** (`lib/routes.ts`, `proxy.ts`): na engleskom su `/collection`, `/product/…`, `/checkout`, `/account`, `/wishlist`, `/tracking`…, sa prevedenim parametrima (`?search=`, `?order=`). Rute u kodu ostaju jedne; prevedenu adresu u njih vodi proxy, a linkovi na sajtu, u emailu, u mapi sajta i kanonske adrese se ispisuju na jeziku sajta. Srpske adrese ruta rade i dalje.
- **Početni sadržaj na jeziku sajta** (`lib/i18n/content.ts`): pri promeni jezika sajta (Podešavanja, ili izbor jezika u čarobnjaku za prvo pokretanje) meni, podnožje, početne stranice, tekstovi stalnih stranica, email poruke i načini dostave prelaze na taj jezik, a početne stranice dobijaju adrese na tom jeziku (`/about`, `/faq`, `/contact`…) uz ispravljene linkove. Menja se samo tekst koji je i dalje jednak početnom; ono što je vlasnik prepisao ostaje.
- **Adresa stranice se menja iz panela** (Stranice → stranica → „Adresa stranice na sajtu"); linkovi ka njoj u meniju, podnožju i sekcijama se ispravljaju sami.
- **Prodavnica na više jezika uporedo** (`lib/i18n/server.ts`, `lib/translations.ts`, tabela `translations`): uz glavni jezik prodavnica može imati koliko god dodatnih (Podešavanja → Prodavnica → Dodatni jezici sajta: `en, de, fr…`). Kupac bira jezik u zaglavlju sajta; adrese dodatnih jezika počinju sa `/en`, `/de`. Prevodi se upisuju u panelu, deo **Prevodi**, u tri grupe: tekstovi teme i poruke kupcu, sadržaj sajta (meni, podnožje, stranice, dostava, email) i katalog (proizvodi, kategorije, kolekcije). Bez upisanog prevoda važi rečnik iz koda (engleski postoji), pa tekst na glavnom jeziku. Porudžbina i napuštena korpa pamte jezik kupca, pa potvrda, poruke o statusu, podsetnik i račun stižu na njemu. Panel ostaje na srpskom ili engleskom.
- Javni API prima `?lang=`: sadržaj i poruke o grešci na tom jeziku.
- Na engleskom panelu su prevedeni i: zaglavlja CSV izvoza (osim izvoza proizvoda, koji se uvozi nazad), popust i dostava na kartici porudžbine, i email kupcu o zahtevu za povrat (ide na jeziku kupca).
- Stranica Kontakt: okvir pored forme se skuplja kada nema podataka prodavnice, i dobio je polje za fotografiju.

Urađeno 13. 10. 2026 (MVP):

- **Blog** (`lib/blog.ts`, `lib/rich-text.ts`; panel → Blog): članci na `/blog` sa naslovnom fotografijom, kratkim opisom, autorom, oznakama, nacrtom i zakazanom objavom, podacima za pretraživače (i schema.org), filterom po oznaci i stranama. Tekst se piše jednostavnim oznakama (naslov, podnaslov, spisak, citat, link, slika) i iscrtava bez sirovog HTML-a. Članci su u mapi sajta, u delu Prevodi i u javnom API-ju (`/api/v1/blog`).
- **Tema se bira u panelu** (Podešavanja → Tema sajta; `themes/list.ts`, `themes/registry.ts`, `themes/pages.tsx`): uz instalaciju može da stoji više tema, a izabrana važi odmah. Stilove teme jezgro služi posebno (`/api/theme/{id}.css`), samo za izabranu temu, pa se stilovi tema ne mešaju ni međusobno ni sa panelom. Provereno sa privremenom drugom temom; uz instalaciju i dalje stiže jedna.
- **Filteri i proizvodi upitom u bazi** (`lib/listing.ts`, `lib/storefront/collection.ts`; migracija 20): uz svaki upis sadržaja pravi se spisak proizvoda koji mogu da se poruče (cena, kategorije sa nadkategorijama, opcije, tekst za pretragu), pa kategoriju, cenu, opcije, pretragu, redosled i „Učitaj još" računa baza i vraća samo tražene proizvode. Izbor je u adresi (`?cena-od=`, `?opcija=Boja:Siva`, `?sortiraj=`, `?strana=`). Prodavnica više nigde ne učitava ceo katalog: stranica proizvoda, slični proizvodi, sekcije, obračun korpe i porudžbina čitaju proizvode po oznaci, a pregledač dobija samo proizvode koje vidi; korpa i lista želja svoje traže sa servera. Pretraga i redosled po nazivu rade nad glavnim jezikom.
- **Pristup spolja je isključen po podrazumevanom** (panel → Integracije): javni API, API sa ključem i webhook-ovi se uključuju svaki za sebe; dok su isključeni, API odgovara sa 403 i ništa se ne šalje.
- **Zaboravljena lozinka panela**: korisnik sam traži link emailom (`/admin-lozinka`); link važi sat vremena i jednom, nova lozinka odjavljuje sve uređaje. Email adresa je uz korisnika (čarobnjak, Moj nalog, Korisnici).
- **Prijava kupaca Google nalogom** (`lib/google-login.ts`, `/api/auth/google`): svaka prodavnica upisuje svoj Client ID i tajnu u Podešavanjima; bez njih dugmeta nema. Tok sa Google-om nije isproban sa pravim nalogom (nema ga na računaru na kom je rađeno); provereni su početak, odbijanje podmetnutog odgovora i čitanje žetona.
- **Povrat se uključuje i isključuje** (Podešavanja → Plaćanje): prodavnica koja ne radi povrat ne nudi zahtev kupcu.
- **Teme kontakt forme** se upisuju u sekciji Kontakt (Stranice → Kontakt → Teme poruke), više nisu u kodu.
- **Korpa novog posetioca je prazna**; dva proizvoda iz dizajna više se ne dodaju.

Sledeće (redom važnosti):

- **Tržišta (Markets), kao u Shopify-ju**: zemlje u koje prodavnica prodaje, i po tržištu dostava, valuta, jezik i porez; polje za zemlju pri poručivanju. Zamenjuje današnje zone po poštanskim brojevima jedne zemlje.
- **Fiskalni račun**: veza sa fiskalnim servisom (vidi Odluke).
- **Povraćaj kao kod za sledeću kupovinu**, kao opcija koju prodavnica uključuje.
- **Uvoz**: utisci, oznake, porezi, dostava, kupci i porudžbine iz Shopify-jevog i WooCommerce-ovog izvoza.
- **Veliki katalog u panelu**: upis samo izmenjenog proizvoda umesto celog kataloga, i spiskovi u panelu po stranama. Javni API i mapa sajta i dalje čitaju ceo katalog.
- Blog: vizuelni uređivač teksta, komentari, RSS, sekcija „Najnoviji članci" za početnu stranu.
- Druga gotova tema.
- Spoljni API (pravljenje i izmena proizvoda) i webhook-ovi (ponavljanje, istorija): odloženo, nije potrebno za MVP.

Ostaje:

- Prevod je vezan za tekst: kada tekst na glavnom jeziku promenite, njegov prevod više ne važi i upisuje se ponovo. Stari prevodi ostaju u bazi neiskorišćeni.
- Adrese stranica iz panela, kategorija i proizvoda su iste na svim jezicima (`/en/o-nama`, `/en/collection/fotelje`); prevode se samo stalne adrese prodavnice. Jezik bez sopstvenih adresa koristi engleske.
- Stranice nemaju `hreflang` oznake za pretraživače, a mapa sajta navodi samo glavni jezik.
- Novosti i poruke iz kontakt forme idu na glavnom jeziku; prijavljeni na novosti nemaju upisan jezik.
- Za jezike osim engleskog nema gotovog prevoda teme: oko 350 tekstova se prevodi u panelu (do tada su na engleskom).
- Posle promene adrese stranice stara adresa ne preusmerava na novu.
- Engleski panela je proveren čitanjem svih stranica; forme nisu redom slate na engleskom, pa neka poruka o grešci može ostati na srpskom.
- Nova tema se dodaje kao folder i traži nov build; iz panela se bira među temama koje su već u instalaciji, ne ubacuje se kao fajl.
- Uputstvo za postavljanje i za doprinos; javna demo adresa.
- Docker fajlovi nisu pokrenuti (na računaru na kom je ovo rađeno nema Docker-a).
- Webhook koji tri puta ne uspe se ne ponavlja kasnije i nema istoriju slanja, samo poslednji ishod.
- API za spoljne sisteme ne pravi i ne menja proizvode, samo stanje.

## Odluke

| Pitanje | Odluka |
|---|---|
| Uređivač stranica | Sekcije sa poljima, kao Shopify; bez slobodnog prevlačenja elemenata. |
| Više prodavnica | Jedna prodavnica po instalaciji i bazi; postavljanje treba da traje nekoliko minuta. |
| Plaćanje karticom | Opcija i sloj za procesore postoje (`lib/payments.ts`), isključeno po podrazumevanom; procesor se dopisuje kada neko ima ugovor sa bankom. Stripe ne otvara naloge firmama iz Srbije. |
| Licenca | AGPL-3.0: ko kod izmeni i nudi ga kao servis mora da objavi izmene. |
| Dodaci kao u WordPress-u | Ne (odlučeno 13. 10. 2026): tuđi kod se ne instalira u prodavnicu. Spoljni sistemi se povezuju preko API-ja i webhook-ova, koji su isključeni dok ih vlasnik ne uključi. |
| Popusti | Ne sabiraju se: važi jedan, onaj koji kupcu najviše štedi (kod koji je upisao ili automatski popust). |
| Povrat | Prodavnica ga uključuje ili isključuje. Povraćaj kao kod za sledeću kupovinu: kasnije, kao opcija. |
| Prijava Google nalogom | Svaka prodavnica upisuje sopstvene OAuth podatke; uz kod ne idu ničiji. |
| Više zemalja | Preko tržišta (Markets) kao u Shopify-ju: dostava, valuta, jezik i porez po tržištu. Posle bloga. |
| Fiskalni račun | Preko spoljnog fiskalnog servisa (ESIR sa API-jem) kao integracija po zemlji; aplikacija sama ne može biti fiskalna kasa. Nije urađeno. |
| Jezici | Panel: srpski ili engleski. Prodavnica: glavni jezik i koliko god dodatnih, koje kupac bira na sajtu; prevodi se upisuju u panelu. |
| Tema | I zamenljiv folder teme u ovoj aplikaciji, i sadržaj kroz API za sajt van nje. |
| Docker | Ostaje, kao olakšica za druge; nije obavezan. |

## Šta svesno ne ulazi

Prodaja na kasi (POS), više valuta i više skladišta, marketplace sa više prodavaca, pretplate i digitalni proizvodi, prodavnica aplikacija. Svako od toga može kasnije, ali nije potrebno da prodavnica radi samostalno.
