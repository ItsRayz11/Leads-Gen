import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRootOrNull } from "./repo-root.js";

/**
 * Loads the small JSON config files under `config/` (board tokens, seeded
 * agencies, vertical-2 search configs).
 *
 * These used to be read with `readFileSync(repoPath(...))` at *module scope*,
 * which had two failure modes that compounded badly in production:
 *
 *  1. `repoPath` locates the monorepo root by walking up from `process.cwd()`
 *     looking for a package.json with a `workspaces` array. Inside a Vercel
 *     serverless function there is no such layout, so the computed path
 *     pointed at a directory that doesn't exist and every read threw ENOENT.
 *  2. Because the read ran while the module was being evaluated, that ENOENT
 *     escaped as a *module load* failure — the entire /api/discovery/run
 *     route 500'd before any handler or per-connector error handling could
 *     run, so one missing JSON file took down all three verticals.
 *
 * So: resolution tries several plausible roots rather than betting on one,
 * and a miss returns null for the caller to report as that connector's own
 * problem. Callers must invoke this lazily (inside `fetch()`), never at
 * module scope.
 */

/** Roots to look for `config/` under, in priority order. */
function candidateRoots(): string[] {
  const cwd = process.cwd();
  const roots = [
    repoRootOrNull(),
    cwd,
    // Vercel with "Root Directory = apps/web": the function's cwd is the
    // Next.js app directory, and traced files outside it keep their
    // monorepo-relative position two levels up.
    path.join(cwd, "..", ".."),
    path.join(cwd, ".."),
    // Some bundlers place traced files under the task root while cwd stays
    // deeper in the tree.
    "/var/task",
  ];
  return roots.filter((r): r is string => typeof r === "string" && r.length > 0);
}

/** Every absolute path `relPath` might live at, de-duplicated. */
export function configCandidates(relPath: string): string[] {
  const seen = new Set<string>();
  for (const root of candidateRoots()) {
    seen.add(path.resolve(root, relPath));
  }
  return Array.from(seen);
}

const cache = new Map<string, unknown>();

/**
 * Returns the parsed JSON, or null when the file can't be found anywhere.
 * A file that exists but contains invalid JSON throws — that's a real
 * mistake in a file the user edits by hand, and silently treating it as
 * "no config" would hide a typo behind an empty run.
 */
export function readJsonConfig<T>(relPath: string): T | null {
  if (cache.has(relPath)) return cache.get(relPath) as T | null;

  for (const candidate of configCandidates(relPath)) {
    if (!existsSync(candidate)) continue;
    const parsed = JSON.parse(readFileSync(candidate, "utf-8")) as T;
    cache.set(relPath, parsed);
    return parsed;
  }

  cache.set(relPath, null);
  return null;
}

/** The message a connector shows when its config file is missing entirely. */
export function missingConfigMessage(relPath: string): string {
  return `${relPath} was not found in this deployment — the connector has no companies to check. It is read at runtime, so it must be included in the serverless bundle (see outputFileTracingIncludes in apps/web/next.config.js) or the pipeline run from the CLI / GitHub Action instead.`;
}

/** Clears the cache. Tests only — the file set is static at runtime. */
export function resetConfigCache(): void {
  cache.clear();
}
