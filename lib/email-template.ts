/**
 * Naš šablon emaila o porudžbini. Isti šablon ide prodavcu i kupcu; razlikuju
 * se {{naslov}} i {{poruka}}. Vlasnik može da ga preuzme iz admin panela,
 * izmeni i ubaci kao svoj.
 *
 * Tabele i stilovi u samim elementima su namerni: programi za email ne
 * podržavaju savremeni CSS.
 */

/** Mesta u šablonu koja se pri slanju zamenjuju podacima porudžbine. */
export const templatePlaceholders: { key: string; description: string }[] = [
  { key: "naslov", description: "naslov poruke (drugačiji za kupca i za prodavca)" },
  { key: "poruka", description: "uvodna rečenica (drugačija za kupca i za prodavca)" },
  { key: "logo", description: "logo, ili naziv prodavnice ako logo nije ubačen" },
  { key: "naziv_sajta", description: "naziv prodavnice" },
  { key: "broj", description: "broj porudžbine" },
  { key: "datum", description: "datum i vreme porudžbine" },
  { key: "stavke", description: "redovi tabele sa proizvodima (staviti unutar <table>)" },
  { key: "medjuzbir", description: "zbir proizvoda bez dostave" },
  {
    key: "red_popusta",
    description: "red tabele sa popustom iskorišćenim u ovoj porudžbini; prazno ako ga nema",
  },
  { key: "dostava", description: "cena dostave" },
  { key: "naslov_ukupno", description: "natpis uz ukupan iznos, prema načinu plaćanja" },
  { key: "ukupno", description: "ukupan iznos" },
  {
    key: "placanje",
    description: "okvir sa podacima za uplatu na račun; prazno kod plaćanja pouzećem",
  },
  { key: "ime", description: "ime i prezime kupca" },
  { key: "telefon", description: "telefon kupca" },
  { key: "email", description: "email kupca" },
  { key: "adresa", description: "ulica, poštanski broj i mesto" },
  { key: "napomena", description: "napomena kupca" },
  { key: "kontakt", description: "telefon i email prodavnice" },
  {
    key: "popust",
    description:
      "gotov okvir sa kodom za popust za sledeću kupovinu; prazno ako kupac nije dobio kod",
  },
  { key: "naslov_popusta", description: "samo naslov tog popusta (prazno ako ga nema)" },
  { key: "kod_popusta", description: "samo kod za sledeću kupovinu (prazno ako ga nema)" },
  { key: "procenat_popusta", description: "samo procenat tog popusta, npr. 10" },
  { key: "boja_pozadine", description: "boja pozadine" },
  { key: "boja_trake", description: "boja traka" },
  { key: "boja_teksta", description: "boja teksta" },
  { key: "boja_akcenta", description: "boja akcenta" },
];

export const defaultEmailTemplate = `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{naslov}}</title>
</head>
<body style="margin:0;padding:0;background:{{boja_trake}};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{boja_trake}};">
<tr>
<td align="center" style="padding:32px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:{{boja_pozadine}};font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:{{boja_teksta}};">

<tr>
<td align="center" style="padding:32px 32px 24px;border-bottom:1px solid {{boja_trake}};">
{{logo}}
</td>
</tr>

<tr>
<td style="padding:32px 32px 8px;">
<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:{{boja_akcenta}};">Porudžbina br. {{broj}} · {{datum}}</div>
<h1 style="margin:10px 0 12px;font-weight:normal;font-size:30px;line-height:1.15;color:{{boja_teksta}};">{{naslov}}</h1>
<p style="margin:0;">{{poruka}}</p>
</td>
</tr>

<tr>
<td style="padding:0 32px;">
{{placanje}}
{{popust}}
</td>
</tr>

<tr>
<td style="padding:24px 32px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:16px;color:{{boja_teksta}};">
{{stavke}}
<tr>
<td style="padding:10px 0 2px;border-top:1px solid {{boja_teksta}};">Međuzbir</td>
<td align="right" style="padding:10px 0 2px;border-top:1px solid {{boja_teksta}};white-space:nowrap;">{{medjuzbir}}</td>
</tr>
{{red_popusta}}
<tr>
<td style="padding:2px 0;">Dostava</td>
<td align="right" style="padding:2px 0;white-space:nowrap;">{{dostava}}</td>
</tr>
<tr>
<td style="padding:8px 0 0;font-size:18px;font-weight:bold;">{{naslov_ukupno}}</td>
<td align="right" style="padding:8px 0 0;font-size:18px;font-weight:bold;white-space:nowrap;">{{ukupno}}</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="padding:24px 32px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{boja_trake}};font-size:15px;color:{{boja_teksta}};">
<tr>
<td style="padding:18px 20px;">
<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:{{boja_akcenta}};padding-bottom:6px;">Dostava na adresu</div>
<strong>{{ime}}</strong><br>
{{adresa}}<br>
{{telefon}}<br>
{{email}}
<div style="padding-top:8px;">Napomena: {{napomena}}</div>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td align="center" style="padding:20px 32px;background:{{boja_teksta}};color:{{boja_pozadine}};font-size:13px;line-height:1.6;">
{{naziv_sajta}}<br>
{{kontakt}}
</td>
</tr>

</table>

</td>
</tr>
</table>
</body>
</html>
`;
