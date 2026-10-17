import { getPanelT } from "@/lib/i18n/server";
import { notFound, redirect } from "next/navigation";
import { ADMIN_PATH, requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { FOOTER_FIELDS, HEADER_FIELDS, THEME_FIELDS } from "@/lib/site";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import { PageHeader } from "../../ui";
import { editorOptions, HOME_PREVIEW, previewUrl } from "../parts";
import { SettingsEditor } from "../settings-editor";

type SitePartPageProps = { params: Promise<{ deo: string }> };

/** Zaglavlje, podnožje, ili tekstovi jedne stranice sa stalnim rasporedom (lib/templates.ts). */
export default async function SitePartPage({ params }: SitePartPageProps) {
  const t = await getPanelT();
  await requireAdmin("content");
  const { deo } = await params;
  const [settings, { sampleProduct, ...options }] = await Promise.all([getSettings(), editorOptions()]);

  // Boje, fontovi i sopstveni CSS aktivne teme.
  if (deo === "boje") {
    return (
      <>
        <PageHeader title={t("Boje i fontovi")} />
        <SettingsEditor
          key="boje"
          target={{ part: "theme" }}
          hint={t("Četiri boje i dva fonta aktivne teme. Nijanse, tekst na tamnim sekcijama i tekst na dugmadima sajt računa sam, da ostane čitljiv. Boje važe i za email o porudžbini.")}
          fields={THEME_FIELDS}
          value={{ ...settings.colors, fontDisplay: settings.fonts.display, fontBody: settings.fonts.body, customCss: settings.customCss }}
          previewUrl={await previewUrl(HOME_PREVIEW)}
          options={options}
        />
      </>
    );
  }

  // Ranija adresa „Meni i podnožje" vodi na zaglavlje.
  if (deo === "meni") redirect(`${ADMIN_PATH}/izgled/zaglavlje`);
  // Zaglavlje i podnožje su, kao u Shopify-ju, isti na svakoj stranici sajta.
  const group = deo === "zaglavlje" ? HEADER_FIELDS : deo === "podnozje" ? FOOTER_FIELDS : null;
  if (group) {
    const value = Object.fromEntries(group.map((field) => [field.key, settings.site[field.key as keyof typeof settings.site]]));
    return (
      <>
        <PageHeader title={deo === "zaglavlje" ? t("Zaglavlje") : t("Podnožje")} />
        <SettingsEditor
          key={deo}
          target={{ part: "site" }}
          hint={
            deo === "zaglavlje"
              ? t("Isto na svakoj stranici sajta: traka sa obaveštenjima na vrhu i glavni meni.")
              : t("Isto na svakoj stranici sajta: opis prodavnice, kolone sa linkovima i red pri dnu.")
          }
          fields={group}
          value={value}
          previewUrl={await previewUrl(HOME_PREVIEW)}
          options={options}
        />
      </>
    );
  }

  const template = TEMPLATES.find((item) => item.slug === deo);
  if (!template) notFound();
  // Gde se šablon vidi na sajtu; korpa se otvara sa bilo koje stranice.
  const paths: Record<TemplateId, string> = {
    collection: "/kolekcija",
    product: sampleProduct ? `/proizvod/${sampleProduct}` : "/kolekcija",
    account: "/nalog",
    checkout: "/placanje",
    cart: "/kolekcija",
  };

  return (
    <>
      <PageHeader title={t(template.label)} />
      <SettingsEditor
        key={template.id}
        target={{ part: "template", id: template.id }}
        hint={t(template.hint)}
        fields={template.fields}
        value={settings.templates[template.id]}
        previewUrl={await previewUrl(paths[template.id])}
        options={options}
      />
    </>
  );
}
