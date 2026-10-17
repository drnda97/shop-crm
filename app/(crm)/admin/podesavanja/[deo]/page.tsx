import { notFound } from "next/navigation";
import { SETTINGS_PARTS, SettingsView, type SettingsPart } from "../settings-view";

type SettingsPartPageProps = {
  params: Promise<{ deo: string }>;
  searchParams: Promise<{ greska?: string; ok?: string }>;
};

/** Jedan deo podešavanja: /admin/podesavanja/dostava, /placanje, /porez, /email, /nalozi, /analitika. */
export default async function SettingsPartPage({ params, searchParams }: SettingsPartPageProps) {
  const { deo } = await params;
  const part = (Object.keys(SETTINGS_PARTS) as SettingsPart[]).find((key) => SETTINGS_PARTS[key].slug === deo && deo !== "");
  if (!part) notFound();
  return <SettingsView part={part} searchParams={searchParams} />;
}
