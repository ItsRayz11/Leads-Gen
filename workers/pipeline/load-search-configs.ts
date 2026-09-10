import { readFileSync } from "node:fs";
import { createServiceRoleClient } from "@leads/db";
import type { SearchConfig, Vertical } from "@leads/core";
import { repoPath } from "../repo-root.js";

const FALLBACK_CONFIG_PATHS: Record<Vertical, string | null> = {
  hiring: null,
  card_affiliate: null,
  general: repoPath("config/search-configs/vertical2.json"),
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
    }));
  }

  const fallbackPath = FALLBACK_CONFIG_PATHS[vertical];
  if (!fallbackPath) return [{ vertical }];

  const fallback: { configs: Omit<SearchConfig, "vertical">[] } = JSON.parse(
    readFileSync(fallbackPath, "utf-8")
  );
  return fallback.configs.map((c) => ({ vertical, ...c }));
}
