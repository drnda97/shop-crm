import { getPanelT } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/content";
import { SITE_FIELDS } from "@/lib/site";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import { PageHeader } from "../../ui";
import { editorOptions, HOME_PREVIEW, previewUrl, tabs } from "../parts";
import { SettingsEditor } from "../settings-editor";

type SitePartPageProps = { params: Promise<{ deo: string }> };

/** Meni i podnožje, ili tekstovi jedne stranice sa stalnim rasporedom (lib/templates.ts). */
export default async function SitePartPage({ params }: SitePartPageProps) {
  const t = await getPanelT();
  await requireAdmin("content");
  const { deo } = await params;
  const [settings, { sampleProduct, ...options }] = await Promise.all([getSettings(), editorOptions()]);

  if (deo === "meni") {
    return (
      <>
        <PageHeader title={t("Izgled sajta")} />
        <SettingsEditor
          key="meni"
          tabs={tabs("meni")}
          target={{ part: "site" }}
          hint={t("Delovi koji su isti na svakoj stranici: glavni meni, podnožje i traka sa obaveštenjem.")}
          fields={SITE_FIELDS}
          value={settings.site}
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
      <PageHeader title={t("Izgled sajta")} />
      <SettingsEditor
        key={template.id}
        tabs={tabs(template.slug)}
        target={{ part: "template", id: template.id }}
        hint={template.hint}
        fields={template.fields}
        value={settings.templates[template.id]}
        previewUrl={await previewUrl(paths[template.id])}
        options={options}
      />
    </>
  );
}
