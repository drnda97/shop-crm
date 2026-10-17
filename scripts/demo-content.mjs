// Sadržaj demo prodavnice za scripts/seed-demo.mjs: opisi proizvoda, tekstovi umesto mesta za
// dopunu na početnim stranicama (lib/default-pages.ts), podaci prodavnice, blog, kupci,
// porudžbine i utisci. Svi podaci su izmišljeni; email adrese su na example.com.

// Opis i detalji proizvoda; upisuju se samo proizvodu koji još nema opis.
export const productDetails = {
  "fotelja-vera": {
    description:
      "Fotelja sa visokim naslonom i krilima koja zaklanjaju od promaje i buke. Somot boje breskve i noge od masivnog hrasta.",
    attributes: [
      { title: "Opis", text: "Klasičan oblik fotelje sa krilima, sa nešto nižim sedištem za savremene dnevne sobe. Naslon je dovoljno visok da se na njega nasloni glava, pa je dobra za čitanje i popodnevni odmor." },
      { title: "Dimenzije", text: "Širina 78 cm, dubina 84 cm, visina 104 cm. Visina sedišta 43 cm." },
      { title: "Materijali i održavanje", text: "Pamučni somot, ram od bukve, sedište od hladno livene pene, noge od masivnog hrasta. Somot čistiti mekom četkom u smeru vlakna; mrlje upiti, ne trljati." },
    ],
  },
  "stolica-oliva": {
    description: "Trpezarijska stolica sa zaobljenim naslonom, presvučena tkaninom boje masline, na nogama od uljenog hrasta.",
    attributes: [
      { title: "Opis", text: "Naslon prati leđa i obuhvata ih sa strane, pa se na stolici udobno sedi i posle dugog ručka. Lako se slaže uz okrugle i pravougaone stolove." },
      { title: "Dimenzije", text: "Širina 52 cm, dubina 55 cm, visina 80 cm. Visina sedišta 46 cm." },
      { title: "Materijali i održavanje", text: "Tkanina od 100% poliestera otporna na habanje (50.000 ciklusa), noge od masivnog hrasta. Tkaninu brisati vlažnom krpom, drvo suvom." },
    ],
  },
  "barska-stolica-nord": {
    description: "Barska stolica od bukve, bojena u crno, sa osloncem za noge i blago udubljenim sedištem.",
    attributes: [
      { title: "Opis", text: "Jednostavan skandinavski oblik koji staje ispod šanka i kuhinjskog ostrva. Oslonac za noge je od čelika, pa se ne troši ni posle godina korišćenja." },
      { title: "Dimenzije", text: "Visina sedišta 75 cm, za šank visine 100 do 110 cm. Prečnik sedišta 38 cm." },
      { title: "Materijali i održavanje", text: "Masivna bukva, mat crni lak, čelični oslonac. Brisati vlažnom krpom bez sredstava sa alkoholom." },
    ],
  },
  "stolica-lena": {
    description: "Lagana trpezarijska stolica od bukve sa sivim tapaciranim sedištem. Može da se slaže jedna na drugu.",
    attributes: [
      { title: "Opis", text: "Tanke noge i naslon od savijenog drveta čine je lakom za nošenje, a slaže se do četiri stolice u visinu. Dobra je za trpezariju, radni sto i kuhinju." },
      { title: "Dimenzije", text: "Širina 47 cm, dubina 51 cm, visina 79 cm. Visina sedišta 46 cm." },
      { title: "Materijali i održavanje", text: "Masivna bukva, tkanina od mešavine vune i poliestera. Sedište se skida sa četiri zavrtnja i može da se presvuče." },
    ],
  },
  "fotelja-skoljka": {
    description: "Fotelja u obliku školjke na tankom čeličnom postolju, presvučena somotom boje breskve.",
    attributes: [
      { title: "Opis", text: "Rebra na naslonu su ručno prošivena i daju fotelji prepoznatljiv oblik. Sedište je duboko i meko, a postolje vizuelno lako, pa fotelja ne pretrpava prostor." },
      { title: "Dimenzije", text: "Širina 80 cm, dubina 76 cm, visina 82 cm. Visina sedišta 42 cm." },
      { title: "Materijali i održavanje", text: "Poliesterski somot, ram od šperploče, čelično postolje sa prahom bojenom završnom obradom. Somot usisavati nastavkom sa četkom." },
    ],
  },
  "hoklica-hrast": {
    description: "Niska hoklica od masivnog hrasta, visine 65 cm, za kuhinjsko ostrvo ili kao stočić pored fotelje.",
    attributes: [
      { title: "Opis", text: "Sedište je izrađeno od jednog komada hrasta, a noge su usađene klinom, bez metalnih spojeva. Svaka hoklica ima drugačiju šaru drveta." },
      { title: "Dimenzije", text: "Visina 65 cm, prečnik sedišta 34 cm. Za radnu ploču visine 85 do 95 cm." },
      { title: "Materijali i održavanje", text: "Masivni hrast, prirodno ulje. Jednom godišnje premazati uljem za drvo, a vodu sa površine odmah obrisati." },
    ],
  },
  "stolica-kreda": {
    description: "Mat bela stolica od oblikovane plastike sa nogama od bukve. Laka, stabilna i laka za čišćenje.",
    attributes: [
      { title: "Opis", text: "Školjka je jedan komad bez spojeva, pa se lako briše posle obroka. Dobro izgleda u kuhinji, dečjoj sobi i na terasi pod nadstrešnicom." },
      { title: "Dimenzije", text: "Širina 46 cm, dubina 53 cm, visina 81 cm. Visina sedišta 45 cm." },
      { title: "Materijali i održavanje", text: "Reciklirani polipropilen, noge od bukve sa čeličnim ukrućenjem. Plastiku prati blagim deterdžentom." },
    ],
  },
  "fotelja-bela": {
    description: "Kapitonirana fotelja u boji slonovače, sa dugmićima presvučenim istom tkaninom i nogama od tamnog drveta.",
    attributes: [
      { title: "Opis", text: "Kapitoniranje se radi ručno, dugme po dugme, pa naslon dugo zadržava oblik. Fotelja je kompaktna i staje i u spavaću sobu." },
      { title: "Dimenzije", text: "Širina 70 cm, dubina 72 cm, visina 88 cm. Visina sedišta 44 cm." },
      { title: "Materijali i održavanje", text: "Tkanina sa zaštitom od mrlja, ram od bukve, noge od bajcovane bukve. Mrlje očistiti vlažnom krpom i blagim sapunom." },
    ],
  },
  "fotelja-atlas": {
    description: "Fotelja sa širokim naslonima za ruke, presvučena plavim lanom, na nogama od oraha.",
    attributes: [
      { title: "Opis", text: "Nasloni za ruke su dovoljno široki za šolju kafe ili knjigu. Sedište ima opruge i sloj pene, pa je čvrsto i ne ulegne se." },
      { title: "Dimenzije", text: "Širina 82 cm, dubina 80 cm, visina 78 cm. Visina sedišta 42 cm." },
      { title: "Materijali i održavanje", text: "Lan sa 20% pamuka, ram od bukve, noge od masivnog oraha. Jastuk sedišta ima navlaku koja se skida i hemijski čisti." },
    ],
  },
  "par-fotelja-oblak": {
    description: "Dve niske fotelje od buklea u boji slonovače, zaobljenih ivica, koje se prodaju u paru.",
    attributes: [
      { title: "Opis", text: "Oblak je napravljen da se fotelje postave jedna naspram druge ili jedna do druge, kao mala sofa. Duboka sedišta i meki nasloni pozivaju da se sedne sa nogama na fotelji." },
      { title: "Dimenzije", text: "Svaka fotelja: širina 86 cm, dubina 82 cm, visina 70 cm. Visina sedišta 40 cm." },
      { title: "Materijali i održavanje", text: "Bukle od vune i poliestera, ram od šperploče, pena različite gustine. Bukle usisavati nastavkom sa četkom, a petlje koje se izvuku ne čupati već uvući nazad." },
    ],
  },
};

// Podaci prodavnice. Upisuju se samo u polja koja su prazna ili još imaju mesto za dopunu.
export const store = {
  phone: "+381 11 400 1200",
  email: "prodavnica@example.com",
  address: "Dositejeva 12, 11000 Beograd",
  legal: "Demo Shop d.o.o.\nDositejeva 12, 11000 Beograd\nPIB: 100000000\nMatični broj: 20000000\nTekući račun: 160-0000000000000-00",
};

export const bankInstructions =
  "Primalac: Demo Shop d.o.o., Dositejeva 12, Beograd\nRačun: 160-0000000000000-00\nPoziv na broj: broj porudžbine\n\nOvo je demo prodavnica: ne uplaćujte novac.";

// Oznake za dopunu koje vlasnik upisuje u podešavanjima (npr. opis preuzimanja u salonu).
export const placeholderValues = {
  "[ADRESA SALONA]": "Dositejeva 12, Beograd",
  "[NAZIV FIRME]": "Demo Shop d.o.o.",
  "[BROJ RAČUNA]": "160-0000000000000-00",
};

// Traka sa obaveštenjima: dve poruke, da se vidi slider.
export const announcements = [
  { text: "Ovo je demo prodavnica: porudžbine se ne isporučuju i ništa se ne naplaćuje.", href: "" },
  { text: "Besplatna dostava sa unošenjem i montažom za porudžbine preko 50.000 RSD", href: "/pitanja?tema=Dostava" },
];

export const legalLinks = [
  { label: "Uslovi kupovine", href: "/uslovi-kupovine" },
  { label: "Povrat i reklamacije", href: "/povrat-i-reklamacije" },
  { label: "Privatnost", href: "/privatnost" },
];

// Tekstovi za stranice iz lib/default-pages.ts, po adresi stranice i id-ju sekcije. Polje se
// menja samo dok u bazi ima početni tekst; ono što je vlasnik izmenio ostaje.
export const pageTexts = {
  pocetna: {
    banner: {
      text: "Sve modele možete probati u našem salonu u Dositejevoj 12 u Beogradu, radnim danima od 10 do 20 i subotom od 10 do 16.",
    },
    testimonials: {
      items: [
        {
          quote: "Fotelja Mio stoji kod prozora i u nju svi prvo sednu kad dođu. Dostavljači su je uneli na četvrti sprat bez lifta i odneli svu ambalažu.",
          name: "Jelena Marković",
          city: "Beograd",
        },
        {
          quote: "Dizajnerka nam je po fotografijama predložila raspored i tkaninu. Sofa je stigla za osam dana i izgleda tačno kao na uzorku.",
          name: "Nikola Petrović",
          city: "Novi Sad",
        },
        {
          quote: "Kupili smo šest stolica Oliva pre dve godine. Deca ih ne štede, a izgledaju kao prvog dana.",
          name: "Ivana i Marko Jovanović",
          city: "Niš",
        },
      ],
    },
  },
  "o-nama": {
    text: {
      body: "Radimo sa malim radionicama koje poznajemo lično. Svaki komad prolazi kroz naše ruke pre nego što stigne do vas, i svaki nosi ime majstora koji ga je sastavio.\n\nNe pratimo sezone. Kolekciju dopunjujemo samo kada napravimo nešto što zaslužuje mesto u njoj, a ono što jednom uvrstimo ostaje u ponudi godinama, zajedno sa rezervnim delovima.\n\nPrvu radionicu otvorili smo 2014. godine u Zemunu, sa jednim stolom i tri majstora. Danas sarađujemo sa sedam radionica iz Srbije i imamo salon u centru Beograda, ali i dalje svaki model prvo napravimo za sebe.",
    },
  },
  pitanja: {
    faq: {
      items: [
        {},
        {},
        {},
        {},
        { answer: "Da, u salonu platnim karticama većine domaćih banaka, na 3 do 12 mesečnih rata bez kamate. Za kupovinu preko sajta rate još ne nudimo." },
      ],
    },
  },
  kontakt: {
    contact: {
      hours: [
        { time: "10 do 20 h" },
        { time: "10 do 16 h" },
      ],
    },
  },
  "uslovi-kupovine": {
    intro: { text: "Važe za sve porudžbine na ovom sajtu od 1. septembra 2026." },
    text: {
      body: "Demo Shop d.o.o., Dositejeva 12, 11000 Beograd. Matični broj 20000000, PIB 100000000. Email: prodavnica@example.com, telefon: +381 11 400 1200.",
    },
    "text-2": {
      body: "Porudžbinu šaljete preko korpe na sajtu. Odmah dobijate email sa brojem porudžbine, a porudžbina je potvrđena kada vas pozovemo ili vam pišemo radi dogovora o terminu isporuke.\n\nSve cene su u dinarima i sadrže PDV. Cena važi u trenutku slanja porudžbine.",
    },
    "text-3": {
      body: "Plaćate pouzećem, kuriru ili našem timu za dostavu, ili uplatom na račun posle potvrde porudžbine. Kod uplate na račun komad počinjemo da izrađujemo kada uplata stigne.",
    },
    "text-4": {
      body: "Nameštaj isporučujemo na teritoriji Srbije za 5 do 10 radnih dana od potvrde. Dostava sa unošenjem i montažom košta 1.200 RSD, a besplatna je za porudžbine preko 50.000 RSD. Manje pakete šaljemo kurirskom službom, a broj pošiljke dobijate emailom.",
    },
  },
  "povrat-i-reklamacije": {
    intro: { text: "Ako vam komad ne odgovara ili nešto nije u redu, rešićemo to zajedno." },
    text: {
      body: "Od kupovine preko sajta možete odustati u roku od 14 dana od isporuke, bez navođenja razloga, a mi taj rok produžavamo na 30 dana. Dovoljno je da nam pišete na prodavnica@example.com ili zatražite povrat sa stranice za praćenje porudžbine.\n\nProizvod treba da bude neoštećen. Po njega šaljemo naš tim o svom trošku, a novac vraćamo u roku od 14 dana od preuzimanja, na isti način na koji je porudžbina plaćena.",
    },
    "text-2": {
      body: "Reklamaciju podnosite emailom na prodavnica@example.com ili lično u salonu u Dositejevoj 12, uz broj porudžbine i fotografiju nedostatka. Odgovaramo u roku od 8 dana, a nedostatak otklanjamo popravkom, zamenom dela ili celog proizvoda, ili povraćajem novca, najkasnije u roku od 30 dana od prijave.",
    },
  },
  privatnost: {
    intro: { text: "Prikupljamo samo podatke koji su nam potrebni da porudžbina stigne do vas." },
    text: {
      body: "Pri porudžbini: ime i prezime, adresu za isporuku, telefon i email. Pri otvaranju naloga i prijavi na novosti: email i, ako ga upišete, ime. Podatke o plaćanju karticom ne vidimo i ne čuvamo.",
    },
    "text-2": {
      body: "Podatke koristimo za isporuku, račun i odgovore na vaša pitanja, na osnovu ugovora o kupovini. Novosti šaljemo samo uz vaš pristanak, koji možete povući linkom u svakom emailu.\n\nPodatke o porudžbinama čuvamo onoliko koliko propisi o računovodstvu traže, a email za novosti dok se ne odjavite.",
    },
    "text-3": {
      body: "Imate pravo na uvid, ispravku i brisanje svojih podataka. Pišite nam na prodavnica@example.com i odgovorićemo u roku od 15 dana. Ako mislite da su vam prava povređena, možete se obratiti Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti.",
    },
  },
};

// Pravne stranice su u početnom sadržaju nacrti; u demo prodavnici se objavljuju kada su popunjene.
export const publishPages = ["uslovi-kupovine", "povrat-i-reklamacije", "privatnost"];

// Članci na blogu, sa datumom objave pre toliko dana.
export const posts = [
  {
    slug: "kako-izabrati-fotelju",
    title: "Kako izabrati fotelju koja vam odgovara",
    excerpt: "Visina sedišta, dubina i čvrstina govore više od fotografije. Pet stvari koje proveravamo pre nego što model uđe u ponudu.",
    image: "ds-armchair-plant.jpg",
    imageAlt: "Fotelja od buklea pored stočića sa biljkom",
    author: "Milica, dizajnerka",
    tags: "Saveti, Fotelje",
    daysAgo: 41,
    body: "Fotelja se kupuje za sedenje, a ne za gledanje, pa je najbolje da je probate. Kada to nije moguće, pomoći će vam nekoliko mera.\n\n## Visina i dubina sedišta\n\nZa većinu ljudi udobna visina sedišta je između 40 i 45 cm: stopala su na podu, a kolena u visini kukova. Dublje sedište (preko 55 cm) je dobro za podvijanje nogu, ali starijima otežava ustajanje.\n\n## Naslon\n\nNizak naslon izgleda lakše i ne zaklanja prostor, ali visok naslon podupire glavu. Ako u fotelji čitate ili dremate, birajte naslon od bar 95 cm.\n\n## Čvrstina\n\n- Hladno livena pena zadržava oblik godinama.\n- Perje je mekše, ali ga treba protresati.\n- Opruge ispod pene daju čvrsto sedište koje se ne ulegne.\n\n> Sedite u fotelju bar pet minuta. Prvi utisak je uvek mekši od pravog.\n\n## Prostor oko fotelje\n\nOstavite bar 60 cm za prolaz i mesto za mali stočić ili lampu. Fotelja koja nema gde da se spusti šolja brzo postaje mesto za odeću.",
  },
  {
    slug: "nega-masivnog-drveta",
    title: "Nega masivnog drveta: jednom godišnje, deset minuta",
    excerpt: "Uljeno drvo traži malo pažnje, a zauzvrat lepo stari. Šta vam je potrebno i kako se to radi.",
    image: "ds-wood-b.jpg",
    imageAlt: "Ručna obrada drveta dletom",
    author: "Stefan, majstor",
    tags: "Nega nameštaja, Drvo",
    daysAgo: 22,
    body: "Sav naš nameštaj od masivnog drveta završen je uljem, a ne lakom. Ulje ulazi u drvo i ostavlja ga da diše, pa se ogrebotine lako popravljaju.\n\n## Šta vam je potrebno\n\n1. Ulje za drvo na bazi lanenog ulja ili voska.\n2. Dve pamučne krpe bez dlačica.\n3. Fini brusni sunđer (granulacija 240) za ogrebotine.\n\n## Postupak\n\nDrvo obrišite suvom krpom. Nanesite tanak sloj ulja u smeru vlakna i ostavite petnaest minuta. Višak obrišite drugom krpom, pa ostavite da se suši preko noći.\n\nOgrebotinu prvo lagano izbrusite sunđerom, u smeru vlakna, pa je premažite uljem kao i ostatak površine.\n\n## Šta ne raditi\n\n- Ne koristite sredstva sa silikonom ili alkoholom.\n- Ne ostavljajte vlažne čaše na drvetu.\n- Ne stavljajte nameštaj uz sam radijator.",
  },
  {
    slug: "mala-dnevna-soba",
    title: "Mala dnevna soba: tri rasporeda koja rade",
    excerpt: "Kako da u 15 kvadrata smestite sofu, dve fotelje i ostavite mesta za prolaz.",
    image: "ds-living-window.jpg",
    imageAlt: "Svetla dnevna soba sa ugaonom sofom",
    author: "Milica, dizajnerka",
    tags: "Saveti, Uređenje",
    daysAgo: 6,
    body: "Većina stanova koje opremamo ima dnevnu sobu između 14 i 20 kvadrata. Evo tri rasporeda koja najčešće predlažemo.\n\n## Fotelje naspram sofe\n\nSofa uz duži zid, dve fotelje naspram nje i nizak stočić između. Ovaj raspored je najbolji za razgovor i radi i kada televizor nije u centru sobe.\n\n## Ugao za čitanje\n\nAko imate prozor u uglu, tamo postavite fotelju sa visokim naslonom i podnu lampu. Sofa tada ide uz zid naspram prozora, a soba dobija dva mesta za boravak.\n\n## Par fotelja umesto sofe\n\nU jako maloj sobi par niskih fotelja zauzima manje prostora od sofe, a sedi se jednako udobno. Između njih stavite hoklicu koja služi i kao stočić.\n\nPošaljite nam dimenzije i fotografije sobe i predložićemo raspored besplatno.",
  },
];

// Kupci sa nalogom; lozinka im je nasumična, pa se na njihove naloge ne može prijaviti.
export const customers = [
  { first: "Jelena", last: "Marković", email: "jelena.markovic@example.com", phone: "+381 64 100 0101", street: "Bulevar kralja Aleksandra 84", city: "Beograd", postal: "11000" },
  { first: "Nikola", last: "Petrović", email: "nikola.petrovic@example.com", phone: "+381 63 100 0102", street: "Bulevar oslobođenja 45", city: "Novi Sad", postal: "21000" },
  { first: "Ivana", last: "Jovanović", email: "ivana.jovanovic@example.com", phone: "+381 65 100 0103", street: "Obrenovićeva 18", city: "Niš", postal: "18000" },
  { first: "Marija", last: "Nikolić", email: "marija.nikolic@example.com", phone: "+381 64 100 0104", street: "Kneza Miloša 7", city: "Kragujevac", postal: "34000" },
  { first: "Stefan", last: "Ilić", email: "stefan.ilic@example.com", phone: "+381 66 100 0105", street: "Gospodar Jevremova 31", city: "Beograd", postal: "11000" },
  { first: "Ana", last: "Đorđević", email: "ana.djordjevic@example.com", phone: "+381 62 100 0106", street: "Korzo 12", city: "Subotica", postal: "24000" },
  { first: "Miloš", last: "Stanković", email: "milos.stankovic@example.com", phone: "+381 64 100 0107", street: "Jug Bogdanova 3", city: "Čačak", postal: "32000" },
  { first: "Tamara", last: "Popović", email: "tamara.popovic@example.com", phone: "+381 63 100 0108", street: "Zmaj Jovina 22", city: "Novi Sad", postal: "21000" },
  { first: "Luka", last: "Pavlović", email: "luka.pavlovic@example.com", phone: "+381 60 100 0109", street: "Cara Lazara 9", city: "Kraljevo", postal: "36000" },
  { first: "Sara", last: "Milenković", email: "sara.milenkovic@example.com", phone: "+381 64 100 0110", street: "Njegoševa 40", city: "Beograd", postal: "11000" },
];

// Porudžbine: kupac (indeks u spisku), pre koliko dana, status, plaćanje, preuzimanje u salonu,
// stavke [slug, količina, varijanta] i da li je iskorišćen kod dobrodošlice.
export const orders = [
  { customer: 0, daysAgo: 86, status: "delivered", payment: "cod", items: [["okretna-fotelja-mio", 1, ["Pesak", "Hrast"]]] },
  { customer: 1, daysAgo: 79, status: "delivered", payment: "bank", items: [["fotelja-atlas", 1], ["hoklica-hrast", 1]], welcome: true },
  { customer: 2, daysAgo: 74, status: "delivered", payment: "cod", items: [["stolica-oliva", 6]] },
  { customer: 3, daysAgo: 68, status: "delivered", payment: "cod", items: [["stolica-kreda", 4]] },
  { customer: 4, daysAgo: 63, status: "delivered", payment: "bank", pickup: true, items: [["barska-stolica-nord", 3]] },
  { customer: 5, daysAgo: 57, status: "cancelled", payment: "cod", items: [["fotelja-skoljka", 1]] },
  { customer: 6, daysAgo: 52, status: "delivered", payment: "cod", items: [["fotelja-bela", 1]], welcome: true },
  { customer: 0, daysAgo: 47, status: "delivered", payment: "cod", items: [["hoklica-hrast", 2]] },
  { customer: 7, daysAgo: 43, status: "delivered", payment: "bank", items: [["par-fotelja-oblak", 1]] },
  { customer: 8, daysAgo: 38, status: "delivered", payment: "cod", items: [["stolica-lena", 4], ["barska-stolica-nord", 2]] },
  { customer: 9, daysAgo: 34, status: "delivered", payment: "cod", items: [["fotelja-vera", 1]] },
  { customer: 5, daysAgo: 30, status: "delivered", payment: "bank", items: [["fotelja-skoljka", 1], ["stolica-kreda", 2]] },
  { customer: 2, daysAgo: 26, status: "delivered", payment: "cod", pickup: true, items: [["hoklica-hrast", 1]] },
  { customer: 3, daysAgo: 22, status: "delivered", payment: "cod", items: [["okretna-fotelja-mio", 2, ["Grafit", "Orah"]]] },
  { customer: 1, daysAgo: 18, status: "delivered", payment: "bank", items: [["stolica-oliva", 4]] },
  { customer: 4, daysAgo: 14, status: "shipped", payment: "cod", items: [["fotelja-atlas", 2]] },
  { customer: 6, daysAgo: 11, status: "shipped", payment: "bank", items: [["okretna-fotelja-mio", 1, ["Maslina", "Crni jasen"]], ["hoklica-hrast", 1]] },
  { customer: 9, daysAgo: 8, status: "shipped", payment: "cod", items: [["stolica-lena", 6]] },
  { customer: 7, daysAgo: 5, status: "confirmed", payment: "cod", items: [["fotelja-bela", 2]] },
  { customer: 8, daysAgo: 3, status: "confirmed", payment: "bank", items: [["par-fotelja-oblak", 1]], welcome: true },
  { customer: 0, daysAgo: 1, status: "new", payment: "cod", items: [["fotelja-vera", 1], ["stolica-kreda", 2]] },
  { customer: 3, daysAgo: 0, status: "new", payment: "bank", pickup: true, items: [["barska-stolica-nord", 2]] },
];

// Odobreni utisci: kupac, proizvod koji je poručio, ocena i tekst.
export const reviews = [
  { customer: 0, product: "okretna-fotelja-mio", rating: 5, daysAgo: 78, body: "Najudobnija fotelja koju sam imala. Okreće se bez zvuka, a tkanina boje peska je lepša uživo nego na slici." },
  { customer: 3, product: "okretna-fotelja-mio", rating: 5, daysAgo: 15, body: "Uzeli smo dve u grafitu. Mala je taman za ugao, a sedi se kao u mnogo većoj fotelji." },
  { customer: 1, product: "fotelja-atlas", rating: 4, daysAgo: 70, body: "Široki nasloni za ruke su odlični za laptop. Lan se malo gužva, ali to je i očekivano." },
  { customer: 2, product: "stolica-oliva", rating: 5, daysAgo: 66, body: "Šest stolica, sve savršeno sastavljene. Posle dva meseca svakodnevnog korišćenja izgledaju kao nove." },
  { customer: 3, product: "stolica-kreda", rating: 4, daysAgo: 61, body: "Lako se čiste i deca ih lako pomeraju. Za trpezariju bih ipak uzela tapaciranu stolicu." },
  { customer: 4, product: "barska-stolica-nord", rating: 5, daysAgo: 58, body: "Taman visina za naše ostrvo od 105 cm. Čvrste su i ne klimaju se." },
  { customer: 6, product: "fotelja-bela", rating: 5, daysAgo: 46, body: "Kupljena za spavaću sobu i savršeno se uklopila. Kapitoniranje je urađeno precizno." },
  { customer: 7, product: "par-fotelja-oblak", rating: 5, daysAgo: 36, body: "Bukle je mekan i topao, a fotelje su tako duboke da u njima zaspim. Vredi svakog dinara." },
  { customer: 8, product: "stolica-lena", rating: 4, daysAgo: 31, body: "Lagane i lepe, a dobro je što mogu da se slažu. Sedište je malo tvrđe nego što sam očekivao." },
  { customer: 9, product: "fotelja-vera", rating: 5, daysAgo: 27, body: "Boja breskve je nežna i topla, baš kako sam želela. Visok naslon je odličan za čitanje." },
  { customer: 5, product: "fotelja-skoljka", rating: 5, daysAgo: 24, body: "Svi gosti pitaju odakle je. Sedište je duboko i mekano, a postolje stabilno." },
  { customer: 2, product: "hoklica-hrast", rating: 5, daysAgo: 20, body: "Prelepa šara drveta. Koristim je kao stočić pored fotelje i za sedenje kad zatreba." },
];
