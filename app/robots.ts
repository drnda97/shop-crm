import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/storefront/pages";

export const dynamic = "force-dynamic";

/** Pretraživači ne ulaze u panel, API, nalog kupca i plaćanje. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/nalog", "/placanje", "/korpa", "/account", "/checkout", "/cart"] },
    sitemap: `${await siteUrl()}/sitemap.xml`,
  };
}
