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

### Faza 2 — Katalog

- Varijante: opcije proizvoda postoje od Faze 1 (izbor ide u porudžbinu), ali bez sopstvene cene, šifre, stanja i slike po varijanti — to je posao ove faze.
- Podkategorije, proizvod u više kategorija, filteri po osobinama i ceni, sortiranje.
- Uvoz i izvoz proizvoda u CSV-u, uključujući uvoz Shopify i WooCommerce izvoza: to je put kojim postojeće prodavnice prelaze.
- Izmena više proizvoda odjednom, povezani proizvodi, istorija promena stanja.

### Faza 3 — Porudžbine, plaćanje, dostava

- Plaćanje karticom: opcija u Podešavanja → Plaćanje, isključena dok se ne poveže procesor. U kodu zajednički sloj za procesore (pokretanje plaćanja, povratak kupca, potvrda od banke), tako da onaj ko ima ugovor sa bankom dopiše samo svoj procesor.
- Dostava: zone, cena po težini ili iznosu, više načina dostave, broj pošiljke i link za praćenje u emailu.
- PDV i račun u PDF-u.
- Ručna porudžbina iz panela, izmena porudžbine, povraćaj (delimičan i ceo), istorija događaja na porudžbini.
- Email kupcu pri svakoj promeni statusa, sa tekstovima koji se menjaju u panelu.
- Napuštena korpa: podsetnik emailom.

### Faza 4 — Kupci i marketing

- Nalog kupca: zaboravljena lozinka, sačuvane adrese, praćenje porudžbine bez naloga.
- Utisci o proizvodima sa odobravanjem, lista želja.
- Popusti: fiksni iznos, besplatna dostava, popust na proizvod ili kategoriju, automatski popust bez koda.
- Novosti: izvoz prijavljenih adresa i slanje poruke iz panela.
- Izveštaji po periodu, GA4 i Meta Pixel, traka za saglasnost za kolačiće.
- Izvoz i brisanje podataka kupca na zahtev.

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
| Plaćanje karticom | Opcija postoji, isključena je po podrazumevanom; procesor se dopisuje kada neko ima ugovor sa bankom. Stripe ne otvara naloge firmama iz Srbije. |
| Licenca | Otvoreno do Faze 6. MIT ako je cilj što više korisnika; AGPL ako ne želite da neko od koda napravi zatvoren plaćeni servis. |
| Dodaci kao u WordPress-u | Ne u prvoj verziji; webhook-ovi i API, a sistem dodataka tek ako ga korisnici traže. (predlog, nije potvrđeno) |
| Jezici | Srpski i engleski pred objavljivanje; prevod se priprema u kodu od Faze 1. (predlog, nije potvrđeno) |

## Šta svesno ne ulazi

Prodaja na kasi (POS), više valuta i više skladišta, marketplace sa više prodavaca, pretplate i digitalni proizvodi, prodavnica aplikacija. Svako od toga može kasnije, ali nije potrebno da prodavnica radi samostalno.
