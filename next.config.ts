import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships binary font-metric (.afm) files that the bundler cannot
  // trace. Keeping it external makes the PDF engine load them at runtime.
  serverExternalPackages: ["pdfkit"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Microphone stays allowed: voice capture is a core feature.
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
