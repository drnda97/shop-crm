import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Projekat živi u podfolderu (htdocs), pa koren navodimo izričito.
  turbopack: { root: __dirname },
  experimental: {
    // Admin panel šalje fotografije kroz server akcije; podrazumevano je 1 MB.
    // Mora biti nešto više od MAX_IMAGE_BYTES u lib/content.ts.
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
