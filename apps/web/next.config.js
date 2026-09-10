/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
