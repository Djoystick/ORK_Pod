import type { MetadataRoute } from "next";

import { getSiteUrl, toAbsoluteSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/auth", "/auth/"],
      },
    ],
    sitemap: toAbsoluteSiteUrl("/sitemap.xml"),
    host: new URL(getSiteUrl()).host,
  };
}
