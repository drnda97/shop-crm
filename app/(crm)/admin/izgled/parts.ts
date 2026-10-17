import { ADMIN_PATH, previewToken } from "@/lib/admin-auth";
import { HOME_SLUG, isAvailable, pagePath } from "@/lib/catalog";
import { getCollections, getPages, getProducts, listUploads } from "@/lib/content";
import { PREVIEW_PARAM } from "@/lib/storefront/preview-names";
import { TEMPLATES } from "@/lib/templates";

/** Zajedničko za stranice dela Izgled sajta: delovi u bočnom meniju, ponuda linkova i slika, adresa pregleda. */

const BASE = `${ADMIN_PATH}/izgled`;

/** Delovi izgleda sajta, redom; u bočnom meniju su ispod stavke „Izgled sajta". Naziv je za t(). */
export function designParts(): { href: string; label: string }[] {
  return [
    { href: BASE, label: "Teme" },
    { href: `${BASE}/boje`, label: "Boje i fontovi" },
    { href: `${BASE}/zaglavlje`, label: "Zaglavlje" },
    { href: `${BASE}/podnozje`, label: "Podnožje" },
    ...TEMPLATES.map((item) => ({ href: `${BASE}/${item.slug}`, label: item.label })),
  ];
}

/** Adresa sajta sa žetonom za pregled nesačuvanih izmena. */
export async function previewUrl(path: string): Promise<string> {
  return `${path}?${PREVIEW_PARAM}=${await previewToken()}`;
}

export const HOME_PREVIEW = `/${HOME_SLUG}`;

export async function editorOptions() {
  const [pages, products, media, collections] = await Promise.all([getPages(), getProducts(), listUploads(), getCollections()]);
  return {
    collections: [],
    products: products.map((item) => ({ value: item.slug, label: item.name })),
    links: [
      ...pages.filter((page) => page.published).map((page) => ({ value: pagePath(page.slug), label: page.title })),
      { value: "/kolekcija", label: "Kolekcija (svi proizvodi)" },
      ...collections.map((collection) => ({ value: `/kolekcija/${collection.id}`, label: `Kolekcija: ${collection.name}` })),
      { value: "/nalog", label: "Nalog kupca" },
    ],
    media: media.map((file) => file.src),
    /** Proizvod na kom se gleda šablon „Proizvod": prvi koji može da se poruči. */
    sampleProduct: products.find(isAvailable)?.slug,
  };
}
