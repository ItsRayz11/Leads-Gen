import { missingServiceRoleEnv } from "@leads/db";
import { createClient } from "../supabase/server";
import type { SearchConfig } from "@leads/db/types.js";

export async function listSearchConfigs(): Promise<SearchConfig[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("search_configs")
    .select("*")
    .order("vertical", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Whether a discovery run triggered from this page can write anything at all.
 *
 * Every vertical ends in dedupeAndUpsert, which needs the service-role client
 * to bypass RLS. Without those env vars the run gets as far as fetching from
 * the connectors and then dies at the first write — so say it up front rather
 * than after the user has waited out a multi-minute scrape.
 */
export function discoveryWriteBlocker(): string | null {
  const missing = missingServiceRoleEnv();
  if (!missing) return null;
  return `${missing.join(" and ")} ${
    missing.length > 1 ? "are" : "is"
  } not set on this deployment, so a run can read from the connectors but cannot save anything it finds. Add ${
    missing.length > 1 ? "them" : "it"
  } to the environment variables and redeploy, or run the pipeline from the CLI / the scheduled GitHub Action instead.`;
}
