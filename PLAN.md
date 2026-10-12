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
- Teme kontakt forme („Uzorci tkanina"…) su u kodu.
- Dugme „Nastavi sa Google nalogom" na stranici naloga ne radi; korpa novog posetioca kreće sa dva proizvoda iz dizajna (ako postoje u katalogu). Oba su ostatak demo dizajna.
- SEO polja za proizvod i kategoriju, slika za deljenje po stranici, preusmerenja starih adresa.
- Blog.

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
- Filteri rade nad proizvodima učitanim u pregledač; za kataloge od više hiljada proizvoda treba ih preseliti na server (isto važi i za prepisivanje celog kataloga pri svakoj izmeni).

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
- Popusti se ne sabiraju, i nagrade posle porudžbine su i dalje samo procenat na celu korpu.
- Meta Pixel nije isproban sa pravim nalogom; Google Analytics je proveren samo do učitavanja skripte.
- Novosti idu preko SMTP naloga prodavnice, poruku po poruku; za spiskove od više hiljada adresa treba servis za slanje.
- Povraćaj kao kod za sledeću kupovinu umesto novca nije urađen.

### Faza 5 — Panel za više ljudi

- Korisnici u bazi umesto u `.env`, uloge (vlasnik, prodaja, sadržaj), dnevnik izmena, prijava u dva koraka.

### Faza 6 — Objavljivanje kao otvoren kod

- Licenca, `docker compose`, čarobnjak za prvo pokretanje (baza, nalog vlasnika, osnovna podešavanja).
- Panel i prodavnica na više jezika; sada su tekstovi na srpskom u kodu.
- Tema odvojena od jezgra, da druga prodavnica dobije drugi izgled bez diranja panela.
- Webhook-ovi i API ključevi za spoljne sisteme.
- Uputstvo za postavljanje, za izradu teme i za doprinos; CI; javna demo adresa.

## Odluke

| Pitanje | Odluka |
|---|---|
| Uređivač stranica | Sekcije sa poljima, kao Shopify; bez slobodnog prevlačenja elemenata. |
| Više prodavnica | Jedna prodavnica po instalaciji i bazi; postavljanje treba da traje nekoliko minuta. |
| Plaćanje karticom | Opcija i sloj za procesore postoje (`lib/payments.ts`), isključeno po podrazumevanom; procesor se dopisuje kada neko ima ugovor sa bankom. Stripe ne otvara naloge firmama iz Srbije. |
| Licenca | Otvoreno do Faze 6. MIT ako je cilj što više korisnika; AGPL ako ne želite da neko od koda napravi zatvoren plaćeni servis. |
| Dodaci kao u WordPress-u | Ne u prvoj verziji; webhook-ovi i API, a sistem dodataka tek ako ga korisnici traže. (predlog, nije potvrđeno) |
| Jezici | Srpski i engleski pred objavljivanje; prevod se priprema u kodu od Faze 1. (predlog, nije potvrđeno) |

## Šta svesno ne ulazi

Prodaja na kasi (POS), više valuta i više skladišta, marketplace sa više prodavaca, pretplate i digitalni proizvodi, prodavnica aplikacija. Svako od toga može kasnije, ali nije potrebno da prodavnica radi samostalno.
