/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ultimate/ui", "@ultimate/types"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: process.env.NEXT_PUBLIC_MEDIA_HOST ?? "localhost" },
    ],
  },
};

export default nextConfig;
