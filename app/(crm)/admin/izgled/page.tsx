import { getPanelT } from "@/lib/i18n/server";
import Link from "next/link";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { THEME_FIELDS } from "@/lib/site";
import { PageHeader, textLinkClass } from "../ui";
import { editorOptions, HOME_PREVIEW, previewUrl, tabs } from "./parts";
import { SettingsEditor } from "./settings-editor";

export default async function ThemePage() {
  const t = await getPanelT();
  await requireAdmin("content");
  const [settings, all] = await Promise.all([getSettings(), editorOptions()]);
  const options = { collections: all.collections, products: all.products, links: all.links, media: all.media };

  return (
    <>
      <PageHeader
        title={t("Izgled sajta")}
        hint={
          <>
            Boje, fontovi, meni, podnožje i tekstovi na stranicama prodavnice. Stranice od sekcija (početna,
            o nama…) su u delu{" "}
            <Link href={`${ADMIN_PATH}/stranice`} className={textLinkClass}>
              {t("Stranice")}
            </Link>
            , a naziv prodavnice i logo u{" "}
            <Link href={`${ADMIN_PATH}/podesavanja`} className={textLinkClass}>
              {t("Podešavanjima")}
            </Link>
            .
          </>
        }
      />
      <SettingsEditor
        tabs={tabs("tema")}
        target={{ part: "theme" }}
        hint={t("Četiri boje i dva fonta. Nijanse, tekst na tamnim sekcijama i tekst na dugmadima sajt računa sam, da ostane čitljiv. Boje važe i za email o porudžbini.")}
        fields={THEME_FIELDS}
        value={{ ...settings.colors, fontDisplay: settings.fonts.display, fontBody: settings.fonts.body }}
        previewUrl={await previewUrl(HOME_PREVIEW)}
        options={options}
      />
    </>
  );
}
