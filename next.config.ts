import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
