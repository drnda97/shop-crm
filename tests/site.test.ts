import { describe, expect, it } from "vitest";
import { defaultSite, mergeSite } from "@/lib/site";

describe("zaglavlje: traka sa obaveštenjima", () => {
  it("jedna poruka iz ranije verzije postaje prva poruka trake", () => {
    const site = mergeSite({ ...defaultSite, announcements: undefined, announcement: "Besplatna dostava", announcementHref: "/pitanja" });
    expect(site.announcements).toEqual([{ text: "Besplatna dostava", href: "/pitanja" }]);
    expect(site.announcementMode).toBe("slider");
  });

  it("bez poruka trake nema; poruka bez teksta se preskače, a nepoznat način prikaza je slider", () => {
    expect(mergeSite({ ...defaultSite, announcement: "" }).announcements).toEqual([]);
    const site = mergeSite({ ...defaultSite, announcements: [{ text: " ", href: "/x" }, { text: "Akcija", href: "" }], announcementMode: "nesto" });
    expect(site.announcements).toEqual([{ text: "Akcija", href: "" }]);
    expect(site.announcementMode).toBe("slider");
  });
});

import { bankDetailsOf, bankText, companyOf, legalText } from "@/lib/settings";

describe("podaci firme i uplate po poljima", () => {
  it("tekst iz ranije verzije se deli na polja, a polja daju isti tekst za račun", () => {
    const legal = "Demo Shop d.o.o.\nDositejeva 12, 11000 Beograd\nPIB: 100000000\nMatični broj: 20000000\nTekući račun: 160-0000000000000-00";
    const company = companyOf({ legal } as never);
    expect(company).toEqual({ name: "Demo Shop d.o.o.", address: "Dositejeva 12, 11000 Beograd", pib: "100000000", mb: "20000000", account: "160-0000000000000-00" });
    expect(legalText(company)).toBe(legal);
  });

  it("podaci za uplatu: poziv na broj se izostavlja (dodaje se sam), ostali redovi su napomena", () => {
    const details = bankDetailsOf({ bankInstructions: "Primalac: Demo Shop d.o.o.\nRačun: 160-0000000000000-00\nPoziv na broj: broj porudžbine\n\nNe uplaćujte novac." } as never);
    expect(details).toEqual({ recipient: "Demo Shop d.o.o.", account: "160-0000000000000-00", bank: "", purpose: "", note: "Ne uplaćujte novac." });
    expect(bankText(details)).toBe("Primalac: Demo Shop d.o.o.\nRačun: 160-0000000000000-00\nNe uplaćujte novac.");
  });

  it("sačuvana polja imaju prednost nad tekstom", () => {
    expect(companyOf({ legal: "Stara firma", company: { name: "Nova firma" } } as never).name).toBe("Nova firma");
  });
});

import { corsHeaders } from "@/lib/api";
import { defaultSettings as baseSettings } from "@/lib/settings";

describe("API iz pregledača (CORS)", () => {
  const ask = (origin: string, store: Partial<typeof baseSettings.store>) =>
    corsHeaders(new Request("https://crm.rs/api/v1/products", { headers: { origin } }), { ...baseSettings, store: { ...baseSettings.store, ...store } })["Access-Control-Allow-Origin"];

  it("dok nijedan sajt nije upisan, nijedan drugi sajt nema dozvolu", () => {
    expect(ask("https://bilo-ko.rs", { allowedOrigins: "", storefrontUrl: "" })).toBeUndefined();
  });

  it("upisan sajt i adresa sajta prodavnice prolaze, ostali ne", () => {
    const store = { allowedOrigins: "https://mojsajt.rs/", storefrontUrl: "https://prodavnica.rs/kolekcija" };
    expect(ask("https://mojsajt.rs", store)).toBe("https://mojsajt.rs");
    expect(ask("https://prodavnica.rs", store)).toBe("https://prodavnica.rs");
    expect(ask("https://tudji.rs", store)).toBeUndefined();
  });
});
