import { SettingsView } from "./settings-view";

type SettingsPageProps = { searchParams: Promise<{ greska?: string; ok?: string }> };

/** Podešavanja → Opšte: podaci prodavnice, logo i povezivanje sajta. */
export default function SettingsPage({ searchParams }: SettingsPageProps) {
  return <SettingsView part="prodavnica" searchParams={searchParams} />;
}
