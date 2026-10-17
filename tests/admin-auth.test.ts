import { describe, expect, it } from "vitest";
import { isValidUsername, normalizeRoles, roleCan, roleName } from "@/lib/admin-auth";
import { DUMMY_HASH, hashPassword, passwordMatches } from "@/lib/password";
import { base32Decode, base32Encode, generateRecoveryCodes, generateSecret, otpauthUrl, totpCode, totpStep, verifyTotp } from "@/lib/totp";

describe("uloge u panelu", () => {
  it("vlasnik sme sve, ostale uloge samo svoj deo", () => {
    for (const area of ["orders", "catalog", "content", "settings", "users"] as const) {
      expect(roleCan("owner", area)).toBe(true);
    }
    expect(roleCan("sales", "orders")).toBe(true);
    expect(roleCan("sales", "catalog")).toBe(true);
    expect(roleCan("sales", "content")).toBe(false);
    expect(roleCan("content", "content")).toBe(true);
    expect(roleCan("content", "orders")).toBe(false);
    // Popusti su novac: prodaja da, sadržaj ne.
    expect(roleCan("sales", "discounts")).toBe(true);
    expect(roleCan("content", "discounts")).toBe(false);
    // Podešavanja, korisnici i dnevnik su samo za vlasnika.
    for (const role of ["sales", "content"] as const) {
      expect(roleCan(role, "settings")).toBe(false);
      expect(roleCan(role, "users")).toBe(false);
    }
  });

  it("uloge koje pravi vlasnik: svoji delovi panela; korisnici i uloge nikad, vlasnik se ne menja", () => {
    const roles = normalizeRoles([
      { id: "magacin", name: "Magacin", areas: ["orders", "catalog", "users", "nesto"] },
      { id: "owner", name: "Lažni vlasnik", areas: [] },
      { id: 5, name: "bez oznake" },
    ]);
    expect(roles.map((role) => role.id)).toEqual(["owner", "magacin"]);
    expect(roles[0].name).toBe("Vlasnik");
    expect(roles[1].areas).toEqual(["orders", "catalog"]);
    expect(roleCan("magacin", "orders", roles)).toBe(true);
    expect(roleCan("magacin", "users", roles)).toBe(false);
    expect(roleCan("owner", "users", roles)).toBe(true);
    // Obrisana uloga ne vidi ništa.
    expect(roleCan("sales", "orders", roles)).toBe(false);
    expect(roleName("magacin", roles)).toBe("Magacin");
  });

  it("korisničko ime: mala slova, cifre i email, bez razmaka", () => {
    expect(isValidUsername("ana")).toBe(true);
    expect(isValidUsername("ana.petrovic@shop.rs")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("ana petrovic")).toBe(false);
    expect(isValidUsername("")).toBe(false);
  });
});

describe("lozinke", () => {
  it("heš se razlikuje za istu lozinku, a provera prolazi samo za pravu", () => {
    const first = hashPassword("duga-lozinka-1");
    expect(first).not.toBe(hashPassword("duga-lozinka-1"));
    expect(passwordMatches("duga-lozinka-1", first)).toBe(true);
    expect(passwordMatches("duga-lozinka-2", first)).toBe(false);
    expect(passwordMatches("bilo šta", "nije-heš")).toBe(false);
    expect(passwordMatches("bilo šta", DUMMY_HASH)).toBe(false);
  });
});

describe("jednokratni kodovi (TOTP)", () => {
  // Tajna iz RFC 6238: ASCII "12345678901234567890".
  const secret = base32Encode(Buffer.from("12345678901234567890"));

  it("base32 u oba smera", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
    expect(base32Decode("gezd gnbv").toString()).toBe("12345");
  });

  it("daje kodove iz RFC 6238 (SHA-1, poslednjih šest cifara)", () => {
    expect(totpCode(secret, 59_000)).toBe("287082");
    expect(totpCode(secret, 1111111109_000)).toBe("081804");
    expect(totpCode(secret, 1234567890_000)).toBe("005924");
    expect(totpCode(secret, 20000000000_000)).toBe("353130");
  });

  it("prihvata trenutni i susedni kod, odbija stariji i pogrešan oblik", () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totpCode(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, ` ${totpCode(secret, now - 30_000)} `, now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now + 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 120_000), now)).toBe(false);
    expect(verifyTotp(secret, "12345", now)).toBe(false);
    expect(verifyTotp(secret, "", now)).toBe(false);
  });

  it("kod pripada svom periodu, da isti ne bi prošao dva puta", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(totpStep(secret, totpCode(secret, now), now)).toBe(step);
    expect(totpStep(secret, totpCode(secret, now - 30_000), now)).toBe(step - 1);
    expect(totpStep(secret, totpCode(secret, now + 30_000), now)).toBe(step + 1);
    expect(totpStep(secret, "000000x", now)).toBeNull();
  });

  it("tajna, adresa za QR kod i rezervni kodovi", () => {
    expect(generateSecret()).toMatch(/^[A-Z2-7]{32}$/);
    const url = new URL(otpauthUrl(secret, "ana@shop.rs", "Moja radnja"));
    expect(url.protocol).toBe("otpauth:");
    expect(url.searchParams.get("secret")).toBe(secret);
    expect(url.searchParams.get("issuer")).toBe("Moja radnja");
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
  });
});
