# Plan razvoja

## Cilj

ShopCRM treba da zameni Shopify i WordPress + WooCommerce za malu i srednju prodavnicu: bez mesečne pretplate, na sopstvenom hostingu. Prvo se koristi za prodavnice bliskih ljudi, a kada bude završen izlazi kao otvoren kod na GitHub-u, da ga može koristiti bilo ko.

Merilo da je gotovo: vlasnik prodavnice koji ne zna da programira može da postavi prodavnicu, promeni svaku stranicu i sekciju sajta, vodi proizvode i porudžbine i naplati karticom, a da ne otvori kod.

## Gde smo sada

Radi: proizvodi, kategorije, kolekcije, porudžbine sa statusima, kupci, poruke, promo kodovi i nagrade, email potvrde, pouzeće i uplata na račun, javni API i `sdk.js`, demo prodavnica sa korpom, plaćanjem i nalozima kupaca.

Najveća rupa u odnosu na cilj: **sadržaj demo prodavnice je upisan u kod.** Hero, prednosti, prostorije, utisci, cela stranica „O nama", pitanja, meni u zaglavlju i naziv „Demo Shop" su u `app/(shop)/`. Deo „Stranice" u panelu postoji, ali ga prodavnica ne čita. Iz panela se danas menjaju samo proizvodi, cene, dostava, plaćanje i popusti.

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

### Faza 0 — Učvrstiti postojeće

- Komitovati trenutno stanje (premeštanje u `app/(crm)` i `app/(shop)` još nije u gitu).
- Verzionisane migracije baze umesto spiska `ADDED_COLUMNS`: sledeće faze menjaju šemu više puta, a žive prodavnice ne smeju da izgube podatke.
- Testovi za obračun korpe, popuste i upis porudžbine.
- Ograničenje broja pokušaja prijave i slanja porudžbina i poruka.

### Faza 1 — Ceo sajt se uređuje iz panela

Ovo je glavni zahtev i najveći posao.

- **Sekcije.** Stranica je uređen spisak sekcija (hero, tekst sa slikom, prednosti, mreža proizvoda, kolekcija, utisci, pitanja, prijava na novosti, slobodan tekst). Svaka vrsta sekcije je komponenta u kodu sa opisom svojih polja; panel iz tog opisa pravi formu. U bazi se čuva redosled i sadržaj.
- **Uređivač stranice** u panelu: dodavanje, brisanje i pomeranje sekcija, forma sa strane, živ pregled sajta pored.
- **Meniji**: glavni meni i kolone podnožja; stavka vodi na stranicu, kategoriju, kolekciju ili adresu.
- **Izgled**: logo, boje, fontovi, traka sa obaveštenjem, društvene mreže. Boje iz Podešavanja već postoje, ali ih prodavnica ne koristi.
- **Biblioteka slika**: jedno mesto za sve slike, izbor postojeće slike u bilo kojoj formi, smanjivanje pri ubacivanju.
- **Stranice**: postojeće „Stranice" postaju stranice od sekcija; uslovi kupovine, privatnost i povraćaj dolaze kao gotovi nacrti.
- **SEO**: naslov i opis za svaku stranicu, proizvod i kategoriju, slika za deljenje, `sitemap.xml`, `robots.txt`, podaci o proizvodu za Google, preusmerenja starih adresa.
- **Blog**: jednostavne objave. Manje je važan od ostalog i može u kasniju fazu.

### Faza 2 — Katalog

- Varijante: opcije (veličina, boja, tkanina) sa sopstvenom cenom, šifrom, stanjem i slikom. Demo prodavnica ih sada upisuje u napomenu porudžbine.
- Podkategorije, proizvod u više kategorija, filteri po osobinama i ceni, sortiranje.
- Uvoz i izvoz proizvoda u CSV-u, uključujući uvoz Shopify i WooCommerce izvoza: to je put kojim postojeće prodavnice prelaze.
- Izmena više proizvoda odjednom, povezani proizvodi, istorija promena stanja.

### Faza 3 — Porudžbine, plaćanje, dostava

- Plaćanje karticom kroz zajednički sloj za procesore, pa prvi procesor prema banci prve prave prodavnice.
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

## Odluke koje treba doneti

| Pitanje | Predlog |
|---|---|
| Koliko slobodan uređivač stranica? | Sekcije sa poljima, kao Shopify. Slobodno prevlačenje elemenata kao Elementor je višestruko veći posao, a vlasnicima lakše kvari izgled. |
| Jedna instalacija za više prodavnica? | Ne. Jedna prodavnica, jedna instalacija i baza; umesto toga postavljanje treba da traje nekoliko minuta. |
| Dodaci kao u WordPress-u? | Ne u prvoj verziji. Webhook-ovi i API pokrivaju većinu potreba; sistem dodataka tek ako ga korisnici traže. |
| Licenca | MIT ako je cilj da ga koristi što više ljudi; AGPL ako ne želite da neko od njega napravi zatvoren plaćeni servis. |
| Koji procesor kartica prvi? | Zavisi od banke prve prodavnice koja ga traži; Stripe ne otvara naloge firmama iz Srbije. |
| Jezici | Srpski i engleski pred objavljivanje; prevod se priprema u kodu od Faze 1, da se kasnije ne prepisuje. |

## Šta svesno ne ulazi

Prodaja na kasi (POS), više valuta i više skladišta, marketplace sa više prodavaca, pretplate i digitalni proizvodi, prodavnica aplikacija. Svako od toga može kasnije, ali nije potrebno da prodavnica radi samostalno.
