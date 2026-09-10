import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Resolves a path relative to the monorepo root by walking up from cwd to
 * find the workspace-root package.json, independent of which directory the
 * process was launched from (tsx CLI runs with cwd = workers/, vitest runs
 * with cwd = repo root) or how the module was loaded.
 *
 * `import.meta.url`-relative resolution (the previous approach) works for
 * plain Node ESM but breaks once webpack bundles this code into a Next.js
 * API route for the in-browser discovery trigger: the bundler's import.meta
 * shim doesn't survive `fileURLToPath`.
 */
let cachedRoot: string | null = null;

function findRepoRoot(): string {
  if (cachedRoot) return cachedRoot;

  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (Array.isArray(pkg.workspaces)) {
          cachedRoot = dir;
          return dir;
        }
      } catch {
        // Malformed package.json — keep walking up.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate the monorepo root (no workspaces package.json found above ${process.cwd()})`);
}

export function repoPath(...segments: string[]): string {
  return path.join(findRepoRoot(), ...segments);
}
