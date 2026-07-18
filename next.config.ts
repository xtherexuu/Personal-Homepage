import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  // Baseline security headers, host-independent (work under `next start` on any
  // platform, not just a CDN with its own header UI). No CSP here on purpose:
  // Next inlines scripts/styles, so a real policy needs nonces — a separate task.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Only meaningful over HTTPS; harmless locally. Preload-ready.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nothing on this site is meant to be framed.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The page uses none of these sensors — say so explicitly.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    // AVIF first (≈20% smaller than WebP) with WebP fallback — both negotiated via
    // the Accept header, so the <Image> and the WebGL texture still share one cache
    // entry. Everything renders at q75: the photo is dithered behind a dark mask, so
    // 75 is visually identical and lets the texture dedupe the <Image> variant.
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    // The hero is a content-hashed static import, so optimized variants are
    // effectively immutable — keep them 31 days so a phone almost always hits a warm
    // AVIF rather than paying the slow cold encode.
    minimumCacheTTL: 2678400,
  },
  allowedDevOrigins: ['192.168.1.24'],
};

export default nextConfig;
