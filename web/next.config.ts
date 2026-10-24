import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // POST /api/takes re-judges a take against its chart, read from disk (never fetched from the request's Host).
  // On Vercel, public/ is served from the CDN and not shipped with server functions, so ship the charts explicitly.
  outputFileTracingIncludes: {
    "/api/takes": ["./public/songs/**/*"],
  },
};

export default nextConfig;
