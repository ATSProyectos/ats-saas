import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad HTTP aplicadas a todas las rutas.
 * Refuerzan la protección del navegador contra clickjacking, sniffing de
 * tipos y fugas de referer. (La CSP estricta se añade en una fase posterior,
 * cuando la UI esté estable, para no romper estilos ni scripts.)
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
