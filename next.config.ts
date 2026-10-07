import type { NextConfig } from "next";

// Cabeçalhos fixos. A CSP com nonce é montada no proxy, por requisição.
const security = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: security }];
  },
};

export default config;
