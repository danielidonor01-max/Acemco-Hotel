import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Sanity CMS image CDN
      { protocol: "https", hostname: "cdn.sanity.io" },
      // Supabase Storage (operational uploads, if used)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
