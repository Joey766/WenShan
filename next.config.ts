import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // The small set of routes can prerender serially, including on Windows.
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
  },
};

export default config;
