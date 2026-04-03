import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ],
    // Next 16 defaults to pathname ** + empty search only, which rejects ?v= cache-busters.
    // Omitting `search` here allows any query string for these paths.
    localPatterns: [{ pathname: "/images/**" }, { pathname: "/uploads/**" }]
  }
};

export default nextConfig;
