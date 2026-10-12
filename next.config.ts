import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  // Generated covers live in Supabase Storage.
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
