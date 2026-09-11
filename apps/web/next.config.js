const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app is the `apps/web` workspace of a monorepo and imports from
  // `packages/*` and `workers/`. Without an explicit tracing root, Next
  // traces from this directory and anything resolved above it (including the
  // config/*.json below) has no representable place in the output bundle —
  // which is how those files ended up missing from the deployed function.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // The connectors this route calls read config/*.json via fs at runtime
  // using a computed path, which @vercel/nft can't trace statically.
  // Globs are relative to this directory; the tracing root above is what
  // lets the copied files keep their monorepo-relative position, which is
  // where workers/config-files.ts looks for them.
  outputFileTracingIncludes: {
    "/api/discovery/run": [
      "../../config/target-companies/*.json",
      "../../config/search-configs/*.json",
    ],
  },
  webpack: (config) => {
    // The workers package uses NodeNext-style ".js" specifiers that point at
    // sibling ".ts" files (works natively for tsc/tsx). Webpack doesn't do
    // that extension swap by default, so teach it to when bundling
    // @leads/workers for the in-browser discovery trigger.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

module.exports = nextConfig;
