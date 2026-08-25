import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        // The studio, private previews, shared books, and APIs never index.
        disallow: ["/app/", "/share/", "/api/", "/signin"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
