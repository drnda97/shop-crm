import type { NextConfig } from "next";

/**
 * Bezbednosna zaglavlja. Prodavnica sme u okvir samo na istom sajtu (pregled u uređivaču
 * panela), panel nigde: tuđ sajt ne može da ga učita u nevidljiv okvir i navede vlasnika na klik.
 * CSP je namerno uzak (okviri, <base>, <object>): skripte teme, Google Analytics i Meta Pixel
 * se učitavaju sa strane, pa im se izvori ne ograničavaju ovde.
 */
const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Pregledač ga poštuje samo preko HTTPS-a, pa lokalni rad preko http-a ne dira.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

function csp(frameAncestors: string): string {
  return `frame-ancestors ${frameAncestors}; base-uri 'self'; object-src 'none'`;
}

const panel = [
  ...common,
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: csp("'none'") },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...common,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: csp("'self'") },
        ],
      },
      // Kasnije pravilo menja ista zaglavlja iz prethodnog.
      { source: "/admin", headers: panel },
      { source: "/admin/:path*", headers: panel },
      { source: "/admin-lozinka/:path*", headers: panel },
      { source: "/admin-lozinka", headers: panel },
    ];
  },
  // Projekat živi u podfolderu (htdocs), pa koren navodimo izričito.
  turbopack: { root: __dirname },
  // pdfkit čita svoje fajlove sa diska, pa se ne pakuje u kod servera.
  serverExternalPackages: ["pdfkit"],
  experimental: {
    // Admin panel šalje fotografije kroz server akcije; podrazumevano je 1 MB.
    // Mora biti nešto više od MAX_IMAGE_BYTES u lib/content.ts.
    serverActions: { bodySizeLimit: "16mb" },
    // Sajt i panel imaju svaki svoj root layout, pa adresu koju nijedna ruta ne prepoznaje
    // prikazuje app/global-not-found.tsx (stranica 404 prodavnice).
    globalNotFound: true,
  },
};

export default nextConfig;
