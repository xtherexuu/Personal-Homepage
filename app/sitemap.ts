import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE,
      // bump when the page content meaningfully changes
      lastModified: "2026-06-25",
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
