# Izveštaj o testiranju — ShopCRM (MVP)

Testirano 13. 10. 2026. uveče, na kodu iz poslednjeg commit-a (`f81f9c1`).

## Kako stojimo

**Osnovni posao prodavnice radi ispravno i nisam uspeo da ga polomim:** poručivanje, cene, popusti, stanje, plaćanje, uloge u panelu i baza izdržali su sve što sam probao. **Pre puštanja na internet treba popraviti 3 ozbiljna bezbednosna propusta** (odeljak 1) — sva tri su mala po obimu izmene.

| | Provera | Prošlo | Palo |
|---|---|---|---|
| Pozitivan tok (ispravna upotreba radi) | 260 | 258 | 2 |
| Negativan tok (pogrešan unos se odbija uz poruku) | 167 | 158 | 9 |
| Pokušaji napada i zloupotrebe | 264 | 249 | 15 |
| **Ukupno** | **691** | **665** | **26** |

Tih 26 palih provera svodi se na 21 različit nalaz, opisan ispod. Uz to prolazi i svih 181 postojećih unit testova, provera tipova i build; lint ima jedno upozorenje.

Šta nisam uspeo da polomim, iako sam ciljano pokušavao:

- **Novac.** Cena, ukupan iznos, popust, status i oznaka „plaćeno" poslati u zahtevu se ignorišu; sve računa server. Na kraju testa svaka od preko 3.000 porudžbina u bazi ima ukupno = međuzbir − popust + dostava, i međuzbir = zbir stavki.
- **Stanje.** 20 kupaca u istom trenutku na poslednji komad: prošla je tačno jedna porudžbina. 30 kupaca na 10 komada: prodato tačno 10. Nigde negativnog stanja.
- **Popusti.** Kod za 3 korišćenja uz 15 istovremenih porudžbina: tačno 3. Kod nagrade ne može dva puta, ni tuđi.
- **Baza.** SQL injection nije prošao ni na jednom polju, adresi ni parametru. Svi upiti koriste parametre.
- **XSS.** HTML i skripte upisane kao ime kupca, proizvod, utisak, poruka, članak ili stranica nigde se ne izvršavaju — ni na sajtu, ni u panelu, ni u emailu.
- **Pristup.** Bez prijave nijedna od ~75 akcija panela ne radi. Uloge „prodaja" i „sadržaj" ne mogu u tuđe delove ni kada se akcija pozove direktno, mimo menija.
- **Fajlovi.** PHP i HTML predstavljeni kao slika se odbijaju, `../` u imenu ne izlazi iz foldera, `.env.local` i kod nisu dostupni preko adrese.

---

## 1. Popraviti pre puštanja na internet

### 1.1 Link za novu lozinku može da vodi na sajt napadača

**Šta se dešava.** Adresa u linku se pravi iz zaglavlja zahteva (`Host` / `X-Forwarded-Host`), a ta zaglavlja šalje onaj ko traži link. Napadač zatraži novu lozinku za tuđ nalog i podmetne svoj domen; žrtva dobije pravi email prodavnice sa linkom koji vodi na napadačev sajt i nosi važeći žeton.

**Potvrđeno.** Zatražio sam link za korisnika panela `prodaja` uz podmetnuto zaglavlje. U emailu je stiglo:
`https://evil.example/admin-lozinka/5razWgP3…` — sa žetonom koji zaista menja lozinku. Isto za nalog kupca (`http://evil.example/nalog/lozinka/…`).

**Posledica.** Ako vlasnik klikne link iz tog emaila, napadač dobija žeton i preuzima panel. Isto za nalog bilo kog kupca.

**Uslov.** Radi samo kada je SMTP podešen i kada hosting propušta to zaglavlje do aplikacije. Mnogi propuštaju `X-Forwarded-Host`.

**Gde.**
- [app/(crm)/admin/user-actions.ts:96](../app/(crm)/admin/user-actions.ts#L96) — panel
- [lib/storefront/pages.ts:97](../lib/storefront/pages.ts#L97) — `siteUrl()`: lozinka kupca, adresa za potvrdu plaćanja karticom, podsetnik za korpu
- [lib/api.ts:56](../lib/api.ts#L56) — adrese slika u API-ju (manje važno)

**Popravka.** Adresu za linkove uzimati samo iz `PUBLIC_URL` ili iz Podešavanja → „Adresa sajta" (`publicBase()` to već radi za novosti). Kada nijedno nije upisano, link ne slati i to javiti u panelu. `docker-compose.yml` već ima `PUBLIC_URL`, ali prazan.

Ista greška ima još jedan oblik: **podsetnik za napuštenu korpu**. Bilo ko može da upiše tuđu email adresu na stranici plaćanja uz podmetnut domen; ako adresa sajta nije upisana u Podešavanjima, prodavnica toj osobi pošalje email sa linkom na napadačev sajt (potvrđeno: `https://evil.example/korpa/vrati/…`). Kada je adresa sajta upisana, link je ispravan.

### 1.2 Ograničenje broja pokušaja se zaobilazi jednim zaglavljem

**Šta se dešava.** Brojač pokušaja vodi se po adresi posetioca, a adresa se čita iz zaglavlja `X-Forwarded-For`, koje posetilac sam šalje. Ko u svakom zahtevu upiše drugu adresu, nema ograničenja.

**Potvrđeno.**
- Prijava u panel: posle blokade na 11. pokušaju, sledeći pokušaj sa drugom vrednošću zaglavlja prolazi normalno.
- Porudžbine: ograničenje je 10 na 10 minuta; uz izmišljene adrese prošlo je 30 od 30 za nekoliko sekundi.
- Kod iz aplikacije za prijavu u dva koraka: 25 od 25 pokušaja je provereno.

**Posledica.** Nagađanje lozinke panela, koda za prijavu u dva koraka i promo kodova bez ograničenja; zatrpavanje lažnim porudžbinama (svaka šalje email prodavcu i može da skine stanje); nagađanje broja porudžbine i adrese na stranici za praćenje. Obrnuto, napadač koji zna adresu vlasnika može je upisati u zaglavlje i tako njemu zaključati prijavu.

**Gde.** [lib/rate-limit.ts:13](../lib/rate-limit.ts#L13) — `clientIp()` uzima prvu adresu iz zaglavlja.

**Popravka.** Uzimati poslednju adresu u nizu (onu koju je dopisao vaš proxy), ili uvesti podešavanje koliko proxy-ja stoji ispred aplikacije. Za prijavu u panel i kod iz aplikacije dodati i brojač po korisničkom imenu, nezavisan od adrese.

### 1.3 Formule u CSV izvozu (porudžbine i kupci)

**Šta se dešava.** Kupac u polje ime, ulica, mesto ili napomena upiše tekst koji počinje sa `=`, `+`, `-` ili `@`. Kada vlasnik otvori izvoz u Excelu, to se čita kao formula.

**Potvrđeno.** Poručio sam sa imenom `=cmd|' /C calc'!A0`. U fajlu iz Porudžbine → Izvoz ćelija počinje baš tim znakom; isto u izvozu kupaca.

**Posledica.** Formula može da pokrene program na računaru vlasnika (Excel pita, ali fajl dolazi iz sopstvenog panela pa mu se veruje) ili da pošalje sadržaj tabele napolje.

**Gde.** [lib/csv.ts:6](../lib/csv.ts#L6) — funkcija `cell`.

**Popravka.** Ćeliji koja počinje sa `=`, `+`, `-`, `@`, tabom ili novim redom dodati apostrof na početak. Jedna izmena pokriva svih pet izvoza.

---

## 2. Srednje važno

| # | Nalaz | Kako sam potvrdio | Gde | Popravka |
|---|---|---|---|---|
| 2.1 | **Nema bezbednosnih zaglavlja.** Panel može da se učita u okviru na tuđem sajtu (klik na prevaru); nema ni CSP, `nosniff`, HSTS; server se predstavlja kao `X-Powered-By: Next.js`. | Odgovor za `/` i `/admin` nema nijedno od tih zaglavlja. | [next.config.ts](../next.config.ts) | `headers()` sa `X-Frame-Options: DENY` (bar za `/admin`), `X-Content-Type-Options`, `Referrer-Policy`, HSTS; `poweredByHeader: false`. |
| 2.2 | **Kod za prijavu u dva koraka važi više puta.** Isti kod prolazi ponovo dok mu traje vreme (do 90 sekundi). | Dve prijave zaredom istim kodom, obe uspešne. | [lib/admin-auth.ts:168](../lib/admin-auth.ts#L168) | Zapamtiti poslednji iskorišćen period po korisniku i odbiti isti ili stariji. |
| 2.3 | **Prodavnica šalje email na adresu koju upiše bilo ko.** Podsetnik za korpu ide na email upisan na stranici plaćanja, bez provere čiji je. | Upisao tuđu adresu, podsetnik je poslat. | [app/(shop)/actions.ts:391](../app/(shop)/actions.ts#L391) | Uz 1.1 i 1.2 ostaje jedan podsetnik po adresi, što je prihvatljivo. Bez njih je sredstvo za spam sa vašeg domena. |
| 2.4 | **Uloga „sadržaj" sme u Popuste.** README kaže da sme stranice, izgled, slike i proizvode. U kodu su popusti deo „kataloga", pa može da napravi i kod od 100%. | Korisnik sa ulogom sadržaj otvara `/admin/popusti`. | [lib/admin-auth.ts:46](../lib/admin-auth.ts#L46) | Odvojiti popuste u poseban deo, ili ispraviti opis uloge. |
| 2.5 | **Prevelika cena ruši stranicu.** Cena preko 2.147.483.647 daje grešku servera umesto poruke. U uvozu jedan takav red obara ceo uvoz. Katalog ostaje ceo. | Proizvod sa cenom `99999999999` → HTTP 500; isti red u CSV-u → HTTP 500, ništa uvezeno. | [lib/format.ts:29](../lib/format.ts#L29) `toMinor` | Gornja granica u `toMinor`; u uvozu preskočiti red uz poruku. |
| 2.6 | **Duga tema u kontakt formi ruši slanje.** Kod skraćuje temu na 120 znakova, a kolona u bazi prima 100. Ako vlasnik u sekciji Kontakt upiše temu dužu od 100 znakova, forma pada za svakog kupca koji je izabere. | Poruka sa temom od 120 znakova → HTTP 500. | [app/(shop)/actions.ts:331](../app/(shop)/actions.ts#L331), [lib/db.ts:176](../lib/db.ts#L176) | Skratiti na 100. |
| 2.7 | **Preuzimanje naloga kupca preko Google prijave.** Registracija ne proverava email. Napadač unapred napravi nalog sa tuđom adresom; kada se vlasnik adrese kasnije prijavi Google-om, ulazi u taj isti nalog, čiju lozinku napadač zna. | Samo čitanjem koda — Google nisam smeo da zovem. | [lib/storefront/auth.ts:71](../lib/storefront/auth.ts#L71) | Pri prvoj Google prijavi u postojeći nalog postaviti novu nasumičnu lozinku i odjaviti ostale sesije. |
| 2.8 | **Prvo pokretanje.** Dok vlasnik nije napravljen, vlasnik postaje ko prvi otvori `/admin`. Dva istovremena pokušaja daju jednog vlasnika, to radi. | Čarobnjak bez ikakve provere. | [app/(crm)/admin/user-actions.ts:134](../app/(crm)/admin/user-actions.ts#L134) | Na javnom serveru tražiti kod iz okruženja ili iz ispisa servera. Za lokalnu instalaciju je u redu ovako. |

---

## 3. Manje važno

| # | Nalaz | Gde |
|---|---|---|
| 3.1 | `npm run seed:demo` ne radi: `Cannot find package '@/lib'`. Skripta uvozi `lib/catalog.ts`, koji koristi skraćenicu `@/`, a Node je van Next-a ne poznaje. README ga navodi kao korak za demo prodavnicu. | [scripts/seed-demo.mjs:12](../scripts/seed-demo.mjs#L12) |
| 3.2 | Bilo koja dva slova na početku adrese rade kao jezik: `/xx`, `/de/kolekcija`, `/zz/proizvod/…` vraćaju istu stranicu sa statusom 200, i kada prodavnica taj jezik nema. Pretraživači to vide kao duple stranice. | [lib/routes.ts:109](../lib/routes.ts#L109) |
| 3.3 | Polje za cenu prima `1e3` (upiše 1000) i `0x10` (upiše 16). | [lib/format.ts:29](../lib/format.ts#L29) |
| 3.4 | Pogrešne prijave u panel se ne upisuju u Dnevnik (uspešne se upisuju). Posle 40+ pogrešnih pokušaja u dnevniku nema traga. | [app/(crm)/admin/actions.ts:156](../app/(crm)/admin/actions.ts#L156) |
| 3.5 | API prima telo zahteva bilo koje veličine (probano 20 MB). | [app/api/v1/[...path]/route.ts:97](../app/api/v1/[...path]/route.ts#L97) |
| 3.6 | `GET /api/v1/products` nema strane: 1.500 proizvoda je 1,3 MB u jednom odgovoru. Spisak proizvoda u panelu je tada 11 MB HTML-a (PLAN.md ovo već navodi). | — |
| 3.7 | Posle porudžbine sa sajta čitaju se sve porudžbine iz baze da bi se našla jedna. Sa 3.000 porudžbina je i dalje ispod sekunde, ali raste sa svakom. | [app/(shop)/actions.ts:517](../app/(shop)/actions.ts#L517) |
| 3.8 | Registracija pozvana sa `null` umesto podataka daje grešku servera. Iz pregledača se ne može desiti. | [app/(shop)/actions.ts:69](../app/(shop)/actions.ts#L69) |
| 3.9 | API za stanje prima `qty: [5]` kao 5. | [app/api/v1/admin/[...path]/route.ts:129](../app/api/v1/admin/[...path]/route.ts#L129) |
| 3.10 | `keys-last.json` je u gitu: spisak tekstova za prevod, 14 KB, nije tajna, ali je radni fajl. | — |
| 3.11 | `docker-compose.yml` ima podrazumevane lozinke baze (`shopcrm`, `shopcrm-root`). Baza nije izložena van Docker mreže, pa je rizik mali. | — |
| 3.12 | SMTP lozinka i Google tajna su u bazi kao običan tekst. Ko dođe do kopije baze, ima i njih. Lozinke, API ključevi i žetoni su heširani. | — |
| 3.13 | Lint: nekorišćen uvoz `useCart`. | [themes/default/components/wishlist.tsx:9](../themes/default/components/wishlist.tsx#L9) |

Za znanje, bez potrebe za izmenom:

- Kada baza nije dostupna, sve stranice vraćaju golu grešku 500. Podaci o bazi se pri tom ne otkrivaju.
- Porudžbina od 0 dinara prolazi (besplatan proizvod uz lično preuzimanje).
- Baza nema strane ključeve; veze među tabelama čuva kod. Posle svih testova nema stavki bez porudžbine ni porudžbina bez stavki.
- Webhook može da gađa i lokalnu adresu servera. Dodaje ga samo vlasnik, pa je prihvatljivo.

---

## 4. Šta je sve provereno

Brojevi su prošlo / palo.

| Oblast | Rezultat | Šta je pokriveno |
|---|---|---|
| Prvo pokretanje i prijava u panel | 28 / 1 | čarobnjak, CSRF, dva čarobnjaka odjednom, pogrešne lozinke, SQL u prijavi, blokada |
| Podešavanja, dostava, plaćanje, PDV, email | 17 / 0 | čuvanje i odbijanje neispravnog; probni email stiže |
| Kategorije, proizvodi, popusti | 42 / 2 | varijante, akcije, nacrti, stanje, 9 vrsta popusta, neispravan unos |
| Korisnici, uloge, API ključevi | 11 / 0 | tri uloge, zauzeto ime, kratka lozinka, ključ samo kao heš |
| Javni API: čitanje i zlonamerni zahtevi | 37 / 1 | nacrti skriveni, bez tajni u odgovoru, SQL, pokvaren JSON, 50.000 stavki |
| Javni API: korpa i obračun | 21 / 0 | dostava po zoni i težini, svaka vrsta popusta, stanje |
| Javni API: porudžbine | 46 / 1 | 5 ispravnih tokova, 20 odbijenih, 15 pokušaja prevare |
| Javni API: zaglavlja i CORS | 1 / 3 | bezbednosna zaglavlja, podmetnuta adresa u odgovoru |
| Prodavnica: stranice i XSS | 55 / 1 | 24 stranice na srpskom i engleskom, skriveni fajlovi, HTML napadača |
| Nalog kupca, poručivanje, praćenje, povrat | 36 / 1 | registracija, prijava, tuđ račun (PDF), tuđa porudžbina, nagađanje brojeva |
| Plaćanje karticom (probni procesor) | 8 / 0 | lažan potpis, potpis druge porudžbine, ista potvrda dva puta |
| Kontakt, novosti, utisci, nova lozinka i brisanje naloga kupca | 30 / 2 | odobravanje utiska, link važi jednom, stare sesije se gase, Google dok nije podešen |
| Panel: sve stranice | 53 / 0 | 35 stranica, nepostojeće adrese, HTML kupca u panelu |
| Panel: porudžbine, povraćaj, ručna porudžbina | 34 / 0 | svi statusi, vraćanje na stanje, dva povraćaja odjednom, zahtev za povrat |
| Panel: izvozi, slike, uvoz, stranice, blog, brisanje | 45 / 3 | 5 izvoza, 9 vrsta fajlova, uvoz sa lokalnim adresama slika, zakazan članak, porudžbina sa obrisanim proizvodom |
| Webhook-ovi, API sa ključem, cron | 41 / 1 | potpis poruke, ključ za čitanje ne menja, obrisan ključ, nagađanje ključa |
| Uloge i akcije bez prijave | 58 / 1 | 28 zatvorenih stranica, 23 direktno pozvane akcije, svih ~75 akcija bez prijave |
| Sesije i prijava u dva koraka | 18 / 2 | isključen korisnik, nova lozinka, poslednji vlasnik, rezervni kodovi |
| Zaboravljena lozinka panela | 7 / 1 | isti odgovor za postojećeg i nepostojećeg, link važi jednom |
| Istovremene porudžbine | 8 / 0 | poslednji komad, prodaja preko stanja, kodovi, izmene kataloga usred prodaje |
| Napuštene korpe, novosti, email, brisanje podataka | 19 / 2 | podsetnik jednom, odjava, 185 uhvaćenih poruka, brisanje podataka kupca |
| Pregled izmena, jezici, filteri, šablon emaila | 33 / 3 | lažni žetoni za pregled, neispravni parametri kolekcije, isključen API |
| Rad sa 3.000 porudžbina i 1.500 proizvoda | 9 / 1 | vremena ispod; 200 posetilaca odjednom |
| Baza posle svega | 8 / 0 | iznosi, stanje, stavke, tabele |

**Brzina** na ovom računaru, sa 3.000 porudžbina i 1.500 proizvoda:

| Stranica | Vreme |
|---|---|
| Početna prodavnice | 14 ms |
| Kolekcija | 9 ms |
| Panel: porudžbine | 50 ms |
| Panel: pregled | 52 ms |
| Panel: proizvodi | 207 ms (11 MB) |
| API: svi proizvodi | 41 ms (1,3 MB) |
| Čuvanje jednog proizvoda | 343 ms |
| 200 posetilaca u istom trenutku | svi dobili stranicu |

---

## 5. Šta nije testirano

- **Izgled i ponašanje u pregledaču.** Nisam imao pregledač: sve je provereno kroz HTTP zahteve (stranica se otvara, sadrži šta treba, akcija radi šta treba). Raspored, mobilni prikaz, korpa u fioci, uređivač stranica mišem i sve što radi JavaScript u pregledaču treba proći ručno.
- **Pravi email.** Poruke je hvatao lažni SMTP server na ovom računaru. Sadržaj je proveren; isporuka kroz pravi nalog nije.
- **Google prijava, pravi procesor kartica, GA4, Meta Pixel.** Sve to zove spolja. Proveren je samo probni procesor i ponašanje dok Google nije podešen.
- **Preuzimanje slika pri uvozu sa javnih adresa.** Proverio sam da se lokalne adrese odbijaju (127.0.0.1, localhost, ::1, decimalni i heksadecimalni zapis, `file://`); pravo preuzimanje nisam.
- **Ranjivosti u paketima.** `npm audit` zove spolja. Pokrenite ga sami.
- **Docker.** Fajlove sam pročitao, sliku nisam gradio.
- **Dugotrajno opterećenje.** Rafali od 100–200 zahteva prolaze; sati rada pod prometom nisu mereni.

---

## 6. Kako je testirano i šta je ostalo iza mene

Napravio sam kopiju projekta u privremenom folderu, zasebnu bazu `shopcrm_test` i pokrenuo produkcijski build na portu 3100. Skripte su kroz HTTP prošle čarobnjak, panel, prodavnicu i API.

- **Vaša baza `shopcrm` i server na portu 3000 nisu dirani.**
- **Ništa nije commit-ovano**; `git status` je isti kao pre, uz ovaj folder.
- **Ništa nije poslato niti preuzeto spolja.** Email i webhook-ovi su išli samo na `127.0.0.1`.
- U kodu projekta nisam promenio nijedan fajl.

Ostalo je:

| Šta | Gde | Brisanje |
|---|---|---|
| Ovaj izveštaj, skripte i svi rezultati | `test-report/` (nije u gitu) | obrišite folder |
| Probna baza sa svim podacima iz testa | `shopcrm_test` u MAMP MySQL-u | `DROP DATABASE shopcrm_test;` |
| Kopija projekta | privremeni folder sistema | briše se sama |

`test-report/rezultati.json` sadrži svih 691 provera sa onim što je viđeno. Skripte u `test-report/skripte/` su pisane za kopiju projekta (putanje i ID-jevi akcija iz tog build-a), pa ne rade direktno iz ovog foldera; služe kao zapis šta je tačno probano i kao osnova ako budete hteli stalne testove.

## Predlog redosleda

1. **1.1, 1.2, 1.3** — tri izmene, svaka u jednom fajlu.
2. **2.1, 2.2, 2.5, 2.6** — zaglavlja, kod u dva koraka, dve greške 500.
3. **3.1** — da demo radi onome ko prvi put skine projekat.
4. Ručni prolaz kroz prodavnicu i panel u pregledaču, na telefonu i računaru.
