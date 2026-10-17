import ShopLayout from "./(shop)/layout";
import { NotFoundPage } from "@/themes/pages";

/**
 * Adresa koju nijedna ruta ne prepoznaje (npr. /nesto/sasvim/pogresno). Sajt i panel imaju
 * odvojene root layoute, pa Next ovde ne prolazi kroz njih: stranica 404 prodavnice se slaže
 * sa istim okvirom kao i ostatak sajta. Nepoznata adresa u panelu ide na app/(crm)/admin/[...ostalo].
 */
export default function GlobalNotFound() {
  return (
    <ShopLayout>
      <NotFoundPage />
    </ShopLayout>
  );
}
