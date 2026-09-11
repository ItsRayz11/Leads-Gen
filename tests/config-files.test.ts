import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configCandidates, missingConfigMessage, readJsonConfig, resetConfigCache } from "../workers/config-files";

/** A real config file that ships in the repo. */
const REAL = "config/target-companies/greenhouse.json";
/**
 * A path that exists nowhere in the repo, so lookups fall past the repo root
 * onto whichever sandbox root the test set up. Using a real filename here
 * would always resolve to the repo's own copy first — which is the correct
 * priority, just not what these cases are checking.
 */
const FIXTURE = "config/target-companies/__vitest-fixture.json";

let sandbox: string;
let originalCwd: string;

beforeEach(() => {
  resetConfigCache();
  originalCwd = process.cwd();
  sandbox = mkdtempSync(path.join(tmpdir(), "leads-config-"));
});

afterEach(() => {
  process.chdir(originalCwd);
  resetConfigCache();
  rmSync(sandbox, { recursive: true, force: true });
});

/** Writes `contents` to `<base>/<rel>` and returns the absolute path. */
function seedConfig(base: string, rel: string, contents: unknown): string {
  const target = path.resolve(base, rel);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(contents), "utf-8");
  return target;
}

describe("configCandidates", () => {
  it("returns absolute paths only", () => {
    for (const candidate of configCandidates(REAL)) {
      expect(path.isAbsolute(candidate)).toBe(true);
    }
  });

  it("de-duplicates roots that resolve to the same place", () => {
    const candidates = configCandidates(REAL);
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it("includes the current working directory", () => {
    process.chdir(sandbox);
    expect(configCandidates(FIXTURE)).toContain(path.resolve(process.cwd(), FIXTURE));
  });

  it("includes a root two levels above cwd, matching a deployed app directory", () => {
    const nested = path.join(sandbox, "apps", "web");
    mkdirSync(nested, { recursive: true });
    process.chdir(nested);
    expect(configCandidates(FIXTURE)).toContain(path.resolve(process.cwd(), "..", "..", FIXTURE));
  });

  it("always offers more than one place to look", () => {
    expect(configCandidates(FIXTURE).length).toBeGreaterThan(1);
  });
});

describe("readJsonConfig", () => {
  it("reads a config file that ships in the repo", () => {
    const loaded = readJsonConfig<{ boardTokens: string[] }>(REAL);
    expect(loaded).not.toBeNull();
    expect(Array.isArray(loaded?.boardTokens)).toBe(true);
  });

  it("reads every config file the discovery pipeline depends on", () => {
    for (const rel of [
      "config/target-companies/greenhouse.json",
      "config/target-companies/lever.json",
      "config/target-companies/ashby.json",
      "config/target-companies/agencies.json",
      "config/search-configs/vertical2.json",
    ]) {
      resetConfigCache();
      expect(readJsonConfig(rel), rel).not.toBeNull();
    }
  });

  it("finds a config sitting directly under cwd", () => {
    process.chdir(sandbox);
    seedConfig(process.cwd(), FIXTURE, { boardTokens: ["acme"] });
    expect(readJsonConfig<{ boardTokens: string[] }>(FIXTURE)).toEqual({ boardTokens: ["acme"] });
  });

  it("finds a config two levels up, the way a deployed function is laid out", () => {
    const nested = path.join(sandbox, "apps", "web");
    mkdirSync(nested, { recursive: true });
    process.chdir(nested);
    seedConfig(sandbox, FIXTURE, { boardTokens: ["from-root"] });
    expect(readJsonConfig<{ boardTokens: string[] }>(FIXTURE)).toEqual({ boardTokens: ["from-root"] });
  });

  it("returns null rather than throwing when the file is nowhere to be found", () => {
    process.chdir(sandbox);
    expect(readJsonConfig(FIXTURE)).toBeNull();
  });

  it("caches a hit so repeated connector calls don't re-read the disk", () => {
    process.chdir(sandbox);
    const target = seedConfig(process.cwd(), FIXTURE, { boardTokens: ["first"] });
    expect(readJsonConfig<{ boardTokens: string[] }>(FIXTURE)).toEqual({ boardTokens: ["first"] });

    writeFileSync(target, JSON.stringify({ boardTokens: ["second"] }), "utf-8");
    expect(readJsonConfig<{ boardTokens: string[] }>(FIXTURE)).toEqual({ boardTokens: ["first"] });

    resetConfigCache();
    expect(readJsonConfig<{ boardTokens: string[] }>(FIXTURE)).toEqual({ boardTokens: ["second"] });
  });

  it("caches a miss too, so a missing file isn't re-stat'd on every call", () => {
    process.chdir(sandbox);
    expect(readJsonConfig(FIXTURE)).toBeNull();
    seedConfig(process.cwd(), FIXTURE, { boardTokens: ["late"] });
    expect(readJsonConfig(FIXTURE)).toBeNull();
  });

  it("throws on a file that exists but holds invalid JSON", () => {
    process.chdir(sandbox);
    const target = path.resolve(process.cwd(), FIXTURE);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, "{ not valid json", "utf-8");
    expect(() => readJsonConfig(FIXTURE)).toThrow();
  });
});

describe("missingConfigMessage", () => {
  it("names the file and points at the bundling fix", () => {
    const message = missingConfigMessage(REAL);
    expect(message).toContain(REAL);
    expect(message).toContain("outputFileTracingIncludes");
  });
});
