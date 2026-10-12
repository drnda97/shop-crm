import { ADMIN_PATH, previewToken } from "@/lib/admin-auth";
import { HOME_SLUG, isAvailable, pagePath } from "@/lib/catalog";
import { getPages, getProducts, listUploads } from "@/lib/content";
import { PREVIEW_PARAM } from "@/lib/storefront/preview-names";
import { TEMPLATES } from "@/lib/templates";

/** Zajedničko za stranice dela Izgled sajta: tabovi, ponuda linkova i slika, adresa pregleda. */

const BASE = `${ADMIN_PATH}/izgled`;

export function tabs(current: string) {
  return [
    { href: BASE, label: "Tema", id: "tema" },
    { href: `${BASE}/meni`, label: "Meni i podnožje", id: "meni" },
    ...TEMPLATES.map((item) => ({ href: `${BASE}/${item.slug}`, label: item.label, id: item.slug })),
  ].map(({ id, ...tab }) => ({ ...tab, current: id === current }));
}

/** Adresa sajta sa žetonom za pregled nesačuvanih izmena. */
export async function previewUrl(path: string): Promise<string> {
  return `${path}?${PREVIEW_PARAM}=${await previewToken()}`;
}

export const HOME_PREVIEW = `/${HOME_SLUG}`;

export async function editorOptions() {
  const [pages, products, media] = await Promise.all([getPages(), getProducts(), listUploads()]);
  return {
    collections: [],
    products: products.map((item) => ({ value: item.slug, label: item.name })),
    links: [
      ...pages.filter((page) => page.published).map((page) => ({ value: pagePath(page.slug), label: page.title })),
      { value: "/kolekcija", label: "Kolekcija (svi proizvodi)" },
      { value: "/nalog", label: "Nalog kupca" },
    ],
    media: media.map((file) => file.src),
    /** Proizvod na kom se gleda šablon „Proizvod": prvi koji može da se poruči. */
    sampleProduct: products.find(isAvailable)?.slug,
  };
}
