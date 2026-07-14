/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const mediaHost = process.env.NEXT_PUBLIC_MEDIA_HOST;

if (isProd && !mediaHost) {
  throw new Error("next.config: NEXT_PUBLIC_MEDIA_HOST là bắt buộc ở production build");
}

const imgSrc = [
  "'self'",
  "data:",
  "https://picsum.photos",
  "https://fastly.picsum.photos",
  mediaHost ? `https://${mediaHost}` : "",
]
  .filter(Boolean)
  .join(" ");

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imgSrc}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig = {
  transpilePackages: ["@ultimate/ui", "@ultimate/types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      ...(isProd ? [] : [{ protocol: "http", hostname: "localhost" }]),
      ...(mediaHost ? [{ protocol: "https", hostname: mediaHost }] : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
