import type { NextConfig } from "next";

// When API_PROXY_TARGET is set (the backend's URL), the app serves the internal API
// from its own origin via a rewrite. This keeps the auth refresh cookie first-party
// (no cross-site cookies) and sidesteps CORS. Only the backend's own prefixes are
// proxied, so the local Next route /api/revalidate (CMS webhook) is untouched.
const apiTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Sanity CMS image CDN
      { protocol: "https", hostname: "cdn.sanity.io" },
      // Supabase Storage (operational uploads, if used)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async rewrites() {
    if (!apiTarget) return [];
    return [
      { source: "/api/v1/:path*", destination: `${apiTarget}/api/v1/:path*` },
      { source: "/api/public/:path*", destination: `${apiTarget}/api/public/:path*` },
    ];
  },
};

export default nextConfig;
