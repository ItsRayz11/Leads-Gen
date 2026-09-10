import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  describeFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
  isFiltersEmpty,
  normalizeFilters,
  type StructuredSearchFilters,
} from "../apps/web/lib/ai/search-filters";

describe("normalizeFilters", () => {
  it("returns empty filters for null, undefined, an array, or a primitive", () => {
    for (const input of [null, undefined, [], "hello", 42]) {
      expect(normalizeFilters(input)).toEqual(EMPTY_FILTERS);
    }
  });

  it("passes through valid array fields, trimming and deduping case-insensitively", () => {
    const result = normalizeFilters({ keywords: ["  Sales  ", "sales", "Marketing"] });
    expect(result.keywords).toEqual(["Sales", "Marketing"]);
  });

  it("drops non-string entries from array fields", () => {
    expect(normalizeFilters({ keywords: ["ok", 5, null, {}, "also ok"] }).keywords).toEqual(["ok", "also ok"]);
  });

  it("caps an array field at 20 entries", () => {
    const many = Array.from({ length: 30 }, (_, i) => `kw${i}`);
    expect(normalizeFilters({ keywords: many }).keywords).toHaveLength(20);
  });

  it.each(["tiers", "statuses", "freshness"] as const)(
    "restricts %s to the allowed enum, case-insensitively, preserving canonical casing",
    (field) => {
      const allowedSample: Record<string, string> = { tiers: "A+", statuses: "won", freshness: "fresh" };
      const result = normalizeFilters({ [field]: [allowedSample[field].toUpperCase(), "not-a-real-value"] });
      expect(result[field]).toEqual([allowedSample[field]]);
    }
  );

  it.each([
    [50, 50],
    ["75", 75],
    [-10, 0],
    [150, 100],
    [42.6, 43],
  ])("clamps and rounds minScore %j to %j", (input, expected) => {
    expect(normalizeFilters({ minScore: input }).minScore).toBe(expected);
  });

  it.each([undefined, null, "", "not a number", NaN])("treats minScore %j as unset", (input) => {
    expect(normalizeFilters({ minScore: input }).minScore).toBeNull();
  });

  it("lowercases a valid vertical and rejects an unknown one", () => {
    expect(normalizeFilters({ vertical: "HIRING" }).vertical).toBe("hiring");
    expect(normalizeFilters({ vertical: "not-a-vertical" }).vertical).toBeNull();
  });

  it("drops unknown keys silently", () => {
    expect(normalizeFilters({ mystery: "field", keywords: ["ok"] })).toEqual({
      ...EMPTY_FILTERS,
      keywords: ["ok"],
    });
  });
});

describe("isFiltersEmpty", () => {
  it("is true for the empty filter set", () => {
    expect(isFiltersEmpty(EMPTY_FILTERS)).toBe(true);
  });

  it.each<[string, Partial<StructuredSearchFilters>]>([
    ["an array field", { keywords: ["x"] }],
    ["minScore", { minScore: 10 }],
    ["vertical", { vertical: "hiring" }],
  ])("is false once %s is set", (_label, patch) => {
    expect(isFiltersEmpty({ ...EMPTY_FILTERS, ...patch })).toBe(false);
  });
});

describe("describeFilters", () => {
  it("summarizes multiple fields into one line", () => {
    const filters = normalizeFilters({ keywords: ["react", "node"], vertical: "hiring", minScore: 70 });
    expect(describeFilters(filters)).toBe("Keywords: react, node · Vertical: hiring · Min score: 70");
  });

  it("reports no filters when everything is empty", () => {
    expect(describeFilters(EMPTY_FILTERS)).toBe("No structured filters");
  });
});

describe("filtersToSearchParams / filtersFromSearchParams round-trip", () => {
  it("round-trips a fully populated filter set", () => {
    const filters = normalizeFilters({
      keywords: ["react", "node"],
      tiers: ["A+", "B"],
      minScore: 60,
      vertical: "general",
    });
    const params = filtersToSearchParams(filters);
    const restored = filtersFromSearchParams(Object.fromEntries(params.entries()));
    expect(restored).toEqual(filters);
  });

  it("round-trips the empty filter set to itself", () => {
    const params = filtersToSearchParams(EMPTY_FILTERS);
    expect(params.toString()).toBe("");
    expect(filtersFromSearchParams({})).toEqual(EMPTY_FILTERS);
  });

  it("reads Next's repeated-param array shape by taking the first value", () => {
    const restored = filtersFromSearchParams({ keywords: ["react|node", "ignored-second-value"] });
    expect(restored.keywords).toEqual(["react", "node"]);
  });
});
