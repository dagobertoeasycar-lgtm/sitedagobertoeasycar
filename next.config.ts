import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "resized-images.autoconf.com.br",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "static.autoconf.com.br",
        pathname: "/**",
      },
      // CDNs de foto dos parceiros sincronizados. Hoje os cards usam <img>
      // simples, então quem manda é a CSP abaixo; isto fica registrado para
      // o dia em que alguém trocar por next/image.
      { protocol: "https", hostname: "autoconf-production.s3.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn-sistema-lojistas.bndv.com.br", pathname: "/**" },
      { protocol: "https", hostname: "*.blob.core.windows.net", pathname: "/**" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com", pathname: "/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/**" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            // img-src precisa listar o CDN de foto de CADA parceiro
            // sincronizado, senão o navegador bloqueia a imagem e o card fica
            // vazio. Hosts por parceiro:
            //   EasyCar e Tchesco Car → autoconf (s3 e resized-images)
            //   Justo Car e Now Car   → bndv.com.br e blob.core.windows.net
            //   Guiotti               → supabase.co
            // Curinga no subdomínio porque esses CDNs trocam de bucket sem aviso.
            value:
              "default-src 'self'; " +
              "img-src 'self' data: https://www.facebook.com " +
              // Tag do Google (Ads): pixels de conversão e remarketing.
              "https://www.googletagmanager.com https://www.google.com https://www.google.com.br " +
              "https://*.doubleclick.net https://www.google-analytics.com " +
              "https://resized-images.autoconf.com.br https://static.autoconf.com.br " +
              "https://autoconf-production.s3.amazonaws.com " +
              "https://cdn-sistema-lojistas.bndv.com.br https://*.bndv.com.br " +
              "https://*.blob.core.windows.net https://*.supabase.co " +
              // Onde as fotos TRATADAS moram (Vercel Blob). Sem este host o
              // navegador bloqueia a foto tratada e o card fica vazio.
              "https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com; " +
              "style-src 'self' 'unsafe-inline'; " +
              `script-src 'self' 'unsafe-inline' https://connect.facebook.net ` +
              "https://www.googletagmanager.com https://www.googleadservices.com " +
              `https://googleads.g.doubleclick.net ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""}; ` +
              "connect-src 'self' https://www.facebook.com https://connect.facebook.net " +
              "https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com " +
              "https://*.doubleclick.net " +
              "https://www.google.com https://www.google.com.br " +
              "https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com; " +
              "media-src 'self' https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com; " +
              "frame-src https://www.google.com https://www.youtube.com https://td.doubleclick.net " +
              "https://www.googletagmanager.com; " +
              "form-action 'self'; frame-ancestors 'self'; base-uri 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
