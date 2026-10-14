import { afterEach, describe, expect, it, vi } from "vitest";
import { resetKeyForTests, seal, sealSettings, unseal, unsealSettings } from "@/lib/secret-box";
import { mergeSettings } from "@/lib/settings";

describe("tajne u bazi", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetKeyForTests();
  });

  it("šifruje i čita nazad; u zapisu nema izvornog teksta", () => {
    vi.stubEnv("DATA_KEY", "probni-kljuc");
    const sealed = seal("smtp-lozinka");
    expect(sealed).toMatch(/^enc:v1:/);
    expect(sealed).not.toContain("smtp-lozinka");
    expect(seal("smtp-lozinka")).not.toBe(sealed);
    expect(unseal(sealed)).toBe("smtp-lozinka");
    expect(seal("")).toBe("");
  });

  it("vrednost upisana pre šifrovanja se čita kakva jeste; drugi ključ daje prazno", () => {
    vi.stubEnv("DATA_KEY", "prvi");
    const sealed = seal("tajna");
    expect(unseal("stara-lozinka")).toBe("stara-lozinka");
    resetKeyForTests();
    vi.stubEnv("DATA_KEY", "drugi");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(unseal(sealed)).toBe("");
  });

  it("podešavanja: šifruju se samo SMTP lozinka i Google tajna", () => {
    vi.stubEnv("DATA_KEY", "probni-kljuc");
    const settings = mergeSettings({});
    settings.mail.smtpPassword = "p";
    settings.mail.smtpUser = "prodaja@mojsajt.rs";
    settings.auth = { googleClientId: "id", googleClientSecret: "g" };
    const stored = JSON.parse(JSON.stringify(sealSettings(settings)));
    expect(stored.mail.smtpUser).toBe("prodaja@mojsajt.rs");
    expect(stored.mail.smtpPassword).toMatch(/^enc:v1:/);
    expect(stored.auth.googleClientSecret).toMatch(/^enc:v1:/);
    const back = mergeSettings(unsealSettings(stored));
    expect(back.mail.smtpPassword).toBe("p");
    expect(back.auth.googleClientSecret).toBe("g");
  });
});
