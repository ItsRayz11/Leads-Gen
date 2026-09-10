import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

/**
 * The workers use NodeNext-style specifiers ("./shared.js") that point at
 * TypeScript sources. Vite resolves the literal path and would miss them, so
 * map a relative .js specifier back to the .ts file next to it.
 */
const tsFromJsSpecifier = {
  name: "ts-from-js-specifier",
  enforce: "pre" as const,
  resolveId(source: string, importer: string | undefined) {
    if (!importer || !source.startsWith(".") || !source.endsWith(".js")) return null;
    const candidate = path.resolve(path.dirname(importer), `${source.slice(0, -3)}.ts`);
    return existsSync(candidate) ? candidate : null;
  },
};

export default defineConfig({
  plugins: [tsFromJsSpecifier],
  resolve: {
    // Longest specifier first — "@leads/db" would otherwise swallow
    // "@leads/db/types.js".
    alias: [
      { find: "@leads/db/types.js", replacement: path.resolve(root, "packages/db/types.ts") },
      { find: "@leads/db", replacement: path.resolve(root, "packages/db/client.ts") },
      { find: "@leads/core", replacement: path.resolve(root, "packages/core/types.ts") },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
