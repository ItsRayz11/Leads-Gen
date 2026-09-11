/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The connectors this route calls read config/*.json via fs at runtime
  // (repoPath() in workers/repo-root.ts) using a computed path, which
  // @vercel/nft can't trace statically — without this the board-token and
  // search-config JSON files 404 (ENOENT) in the deployed function even
  // though the build itself succeeds.
  outputFileTracingIncludes: {
    "app/api/discovery/run/route": ["../../config/target-companies/*.json", "../../config/search-configs/*.json"],
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
