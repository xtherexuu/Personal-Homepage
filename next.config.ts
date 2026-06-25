import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 defaults qualities to [75]; an unlisted quality is silently
    // coerced. Allow-list the hero's 90 so the revealed photo stays crisp.
    qualities: [75, 90],
  },
  allowedDevOrigins: ['192.168.1.24'],
};

export default nextConfig;
