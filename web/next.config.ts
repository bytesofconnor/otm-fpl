import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/compare", destination: "/", permanent: false },
      { source: "/rankings", destination: "/", permanent: false },
      { source: "/predicted", destination: "/", permanent: false },
      { source: "/guides/predicted-xi", destination: "/", permanent: false },
      { source: "/guides/fantrax-export", destination: "/", permanent: false },
    ]
  },
  // Reduce likelihood of dev HMR cache/chunk issues by disabling webpack cache in dev
  webpack: (config, { dev }) => {
    if (dev) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config as any).cache = false;
    }
    return config;
  },
};

export default nextConfig;
