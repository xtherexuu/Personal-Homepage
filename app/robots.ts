import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

// Allow every crawler, including AI agents (GPTBot, ClaudeBot, PerplexityBot,
// Google-Extended, …) — we WANT this site discoverable by search and AI.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
