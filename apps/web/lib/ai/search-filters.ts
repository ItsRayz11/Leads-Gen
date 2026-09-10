import type { Json } from "@leads/db/types.js";

/**
 * The structured shape a natural-language discovery query is interpreted
 * into. Every field maps onto a real column this app can actually filter on
 * (see `applySearchFilters` in lib/data/leads.ts) — nothing here is
 * decorative, so an interpreted search can be re-run against the database
 * rather than just re-read as text.
 */
export interface StructuredSearchFilters {
  keywords: string[];
  excludeKeywords: string[];
  roleKeywords: string[];
  industries: string[];
  countries: string[];
  regions: string[];
  companySizes: string[];
  signalTypes: string[];
  serviceTypes: string[];
  tiers: string[];
  statuses: string[];
  freshness: string[];
  minScore: number | null;
  vertical: string | null;
}

export const EMPTY_FILTERS: StructuredSearchFilters = {
  keywords: [],
  excludeKeywords: [],
  roleKeywords: [],
  industries: [],
  countries: [],
  regions: [],
  companySizes: [],
  signalTypes: [],
  serviceTypes: [],
  tiers: [],
  statuses: [],
  freshness: [],
  minScore: null,
  vertical: null,
};

export const VERTICALS = ["hiring", "general", "card_affiliate"] as const;
export const TIERS = ["A+", "A", "B", "C", "Low Priority"] as const;
export const FRESHNESS_VALUES = ["fresh", "recent", "aging", "stale", "unknown"] as const;
export const STATUSES = [
  "new",
  "researching",
  "qualified",
  "contacted",
  "follow_up",
  "replied",
  "meeting",
  "negotiation",
  "won",
  "no_response",
  "rejected",
  "not_interested",
  "not_a_fit",
  "lost",
  "on_hold",
] as const;

export const FILTER_LABELS: Record<keyof StructuredSearchFilters, string> = {
  keywords: "Keywords",
  excludeKeywords: "Exclude",
  roleKeywords: "Roles",
  industries: "Industries",
  countries: "Countries",
  regions: "Regions",
  companySizes: "Company size",
  signalTypes: "Signal types",
  serviceTypes: "Services",
  tiers: "Tiers",
  statuses: "Statuses",
  freshness: "Freshness",
  minScore: "Min score",
  vertical: "Vertical",
};

const ARRAY_FIELDS = [
  "keywords",
  "excludeKeywords",
  "roleKeywords",
  "industries",
  "countries",
  "regions",
  "companySizes",
  "signalTypes",
  "serviceTypes",
  "tiers",
  "statuses",
  "freshness",
] as const satisfies readonly (keyof StructuredSearchFilters)[];

function toStringArray(value: unknown, allowed?: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (allowed) {
      const match = allowed.find((a) => a.toLowerCase() === trimmed.toLowerCase());
      if (!match) continue;
      if (!out.includes(match)) out.push(match);
      continue;
    }
    if (!out.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) out.push(trimmed);
  }
  return out.slice(0, 20);
}

/**
 * Coerces anything (a model's JSON, a `filters` jsonb column written by an
 * older version, hand-edited input) into a valid filter object. Unknown keys
 * and out-of-range enum values are dropped rather than passed through to a
 * query that would error.
 */
export function normalizeFilters(input: unknown): StructuredSearchFilters {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ...EMPTY_FILTERS };
  const raw = input as Record<string, unknown>;

  const minScoreRaw = raw.minScore;
  const minScoreNum =
    typeof minScoreRaw === "number"
      ? minScoreRaw
      : typeof minScoreRaw === "string" && minScoreRaw.trim() !== ""
        ? Number(minScoreRaw)
        : NaN;

  const verticalRaw = typeof raw.vertical === "string" ? raw.vertical.trim().toLowerCase() : "";

  return {
    keywords: toStringArray(raw.keywords),
    excludeKeywords: toStringArray(raw.excludeKeywords),
    roleKeywords: toStringArray(raw.roleKeywords),
    industries: toStringArray(raw.industries),
    countries: toStringArray(raw.countries),
    regions: toStringArray(raw.regions),
    companySizes: toStringArray(raw.companySizes),
    signalTypes: toStringArray(raw.signalTypes),
    serviceTypes: toStringArray(raw.serviceTypes),
    tiers: toStringArray(raw.tiers, TIERS),
    statuses: toStringArray(raw.statuses, STATUSES),
    freshness: toStringArray(raw.freshness, FRESHNESS_VALUES),
    minScore: Number.isFinite(minScoreNum) ? Math.min(100, Math.max(0, Math.round(minScoreNum))) : null,
    vertical: (VERTICALS as readonly string[]).includes(verticalRaw) ? verticalRaw : null,
  };
}

export function isFiltersEmpty(filters: StructuredSearchFilters): boolean {
  return (
    ARRAY_FIELDS.every((field) => filters[field].length === 0) &&
    filters.minScore === null &&
    filters.vertical === null
  );
}

/** Human-readable one-liner for a filter set, used in tables and headers. */
export function describeFilters(filters: StructuredSearchFilters): string {
  const parts: string[] = [];
  for (const field of ARRAY_FIELDS) {
    const values = filters[field];
    if (values.length > 0) parts.push(`${FILTER_LABELS[field]}: ${values.join(", ")}`);
  }
  if (filters.vertical) parts.push(`${FILTER_LABELS.vertical}: ${filters.vertical.replace(/_/g, " ")}`);
  if (filters.minScore !== null) parts.push(`${FILTER_LABELS.minScore}: ${filters.minScore}`);
  return parts.length > 0 ? parts.join(" · ") : "No structured filters";
}

/** Round-trips filters through URL search params so /leads can honor them. */
export function filtersToSearchParams(filters: StructuredSearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const field of ARRAY_FIELDS) {
    if (filters[field].length > 0) params.set(field, filters[field].join("|"));
  }
  if (filters.vertical) params.set("vertical", filters.vertical);
  if (filters.minScore !== null) params.set("minScore", String(filters.minScore));
  return params;
}

export function filtersFromSearchParams(params: Record<string, string | string[] | undefined>): StructuredSearchFilters {
  const read = (key: string): string[] => {
    const value = params[key];
    const str = Array.isArray(value) ? value[0] : value;
    if (!str) return [];
    return str.split("|").map((s) => s.trim()).filter(Boolean);
  };
  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return normalizeFilters({
    keywords: read("keywords"),
    excludeKeywords: read("excludeKeywords"),
    roleKeywords: read("roleKeywords"),
    industries: read("industries"),
    countries: read("countries"),
    regions: read("regions"),
    companySizes: read("companySizes"),
    signalTypes: read("signalTypes"),
    serviceTypes: read("serviceTypes"),
    tiers: read("tiers"),
    statuses: read("statuses"),
    freshness: read("freshness"),
    minScore: single("minScore"),
    vertical: single("vertical"),
  });
}

export function filtersToJson(filters: StructuredSearchFilters): Json {
  return filters as unknown as Json;
}
