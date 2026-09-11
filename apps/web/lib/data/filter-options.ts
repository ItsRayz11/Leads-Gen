import { createClient } from "../supabase/server";
import {
  COMPANY_SIZES,
  COUNTRIES,
  EXCLUDE_SUGGESTIONS,
  INDUSTRIES,
  REGIONS,
  ROLE_SUGGESTIONS,
  SERVICE_TYPE_SUGGESTIONS,
} from "../ai/search-filters";

/** How many distinct real values to pull per free-text column, at most. */
const DISTINCT_SAMPLE_LIMIT = 2000;
const MAX_OPTIONS_PER_FIELD = 300;

function mergeDedupeSorted(seed: readonly string[], real: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of [...seed, ...real]) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return Array.from(seen.values())
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_OPTIONS_PER_FIELD);
}

async function distinctColumn(
  table: "companies" | "leads",
  column: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .not(column, "is", null)
    .limit(DISTINCT_SAMPLE_LIMIT);
  if (error || !data) return [];
  const values = new Set<string>();
  for (const row of data as unknown as Record<string, unknown>[]) {
    const value = row[column];
    if (typeof value === "string" && value.trim()) values.add(value.trim());
  }
  return Array.from(values);
}

export interface FilterOptions {
  industries: string[];
  countries: string[];
  regions: string[];
  companySizes: string[];
  serviceTypes: string[];
  roleKeywords: string[];
  excludeKeywords: string[];
}

/**
 * The option lists the Discovery filter dropdowns render. `industries`,
 * `countries`, and `companySizes` already have a fixed taxonomy
 * (search-filters.ts) shared with lead qualification/scoring, so those are
 * just enriched with any real value already sitting in the database that
 * isn't in the curated list yet. `regions`, `serviceTypes`, and
 * `roleKeywords` have no DB enum at all (they're free text — see
 * lib/data/leads.ts), so they're seeded from a curated starting list and
 * grown from whatever real leads/companies actually contain.
 */
export async function getFilterOptions(): Promise<FilterOptions> {
  const [regions, serviceTypes, opportunityTypes, industriesReal, countriesReal] = await Promise.all([
    distinctColumn("companies", "region"),
    distinctColumn("leads", "service_type"),
    distinctColumn("leads", "opportunity_type"),
    distinctColumn("companies", "industry"),
    distinctColumn("companies", "country"),
  ]);

  return {
    industries: mergeDedupeSorted(INDUSTRIES, industriesReal),
    countries: mergeDedupeSorted(COUNTRIES, countriesReal),
    regions: mergeDedupeSorted(REGIONS, regions),
    companySizes: mergeDedupeSorted(COMPANY_SIZES, []),
    serviceTypes: mergeDedupeSorted(SERVICE_TYPE_SUGGESTIONS, [...serviceTypes, ...opportunityTypes]),
    roleKeywords: mergeDedupeSorted(ROLE_SUGGESTIONS, []),
    excludeKeywords: mergeDedupeSorted(EXCLUDE_SUGGESTIONS, []),
  };
}
