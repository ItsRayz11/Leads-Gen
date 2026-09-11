import { createServiceRoleClient } from "@leads/db";
import type { LiveSearchProvider, SearchConfig, Vertical } from "@leads/core";
import { LIVE_SEARCH_PROVIDERS } from "@leads/core";
import { readJsonConfig } from "../config-files.js";

function toLiveSearchProviders(value: string[] | null | undefined): LiveSearchProvider[] | undefined {
  if (!value || value.length === 0) return undefined;
  const valid = value.filter((v): v is LiveSearchProvider => (LIVE_SEARCH_PROVIDERS as readonly string[]).includes(v));
  return valid.length > 0 ? valid : undefined;
}

/**
 * Relative paths, resolved and read on demand — calling repoPath() here at
 * module scope threw inside a serverless bundle (no monorepo root above the
 * function), which failed the import of every module downstream of this one.
 */
const FALLBACK_CONFIG_FILES: Record<Vertical, string | null> = {
  hiring: null,
  card_affiliate: null,
  general: "config/search-configs/vertical2.json",
  live_search: null,
};

/**
 * DB-backed search configs (the flexible pattern vertical 2 needs) with a
 * JSON-file fallback so the pipeline still runs before anyone's added
 * search_configs rows via the dashboard.
 */
export async function loadSearchConfigs(vertical: Vertical): Promise<SearchConfig[]> {
  const supabase = createServiceRoleClient();
  const { data: rows } = await supabase
    .from("search_configs")
    .select("*")
    .eq("vertical", vertical)
    .eq("enabled", true);

  if (rows && rows.length > 0) {
    return rows.map((r) => ({
      vertical,
      keywords: r.keywords ?? undefined,
      industries: r.industries ?? undefined,
      geography: r.geography ?? undefined,
      excludeKeywords: r.exclude_keywords ?? undefined,
      liveSearchProviders: toLiveSearchProviders(r.live_search_providers),
    }));
  }

  const fallbackFile = FALLBACK_CONFIG_FILES[vertical];
  if (!fallbackFile) return [{ vertical }];

  const fallback = readJsonConfig<{ configs: Omit<SearchConfig, "vertical">[] }>(fallbackFile);
  // No rows and no bundled fallback file: the caller reports "no search
  // configs" rather than this throwing mid-run.
  if (!fallback) return [];
  return fallback.configs.map((c) => ({ vertical, ...c }));
}
