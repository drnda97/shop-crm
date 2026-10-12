"use client";

import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { switchLang } from "@/lib/routes";
import { useCart } from "./cart";

/**
 * Izbor jezika: vodi na istu stranicu na izabranom jeziku. Prikazuje se samo kada prodavnica
 * ima više jezika (Podešavanja → Prodavnica → Dodatni jezici sajta).
 */
export function LangSwitch() {
  const t = useT();
  const pathname = usePathname();
  const { config } = useCart();
  if (config.languages.length < 2) return null;

  return (
    <select
      className="lang-switch"
      aria-label={t("Jezik")}
      value={config.lang}
      onChange={(event) => {
        // Cela stranica se učitava ponovo, da i korpa i meni stignu na novom jeziku.
        window.location.assign(switchLang(pathname, window.location.search, config.lang, event.target.value, config.mainLang));
      }}
    >
      {config.languages.map((language) => (
        <option key={language.code} value={language.code} lang={language.code}>
          {language.name}
        </option>
      ))}
    </select>
  );
}
