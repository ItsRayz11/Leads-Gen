import { createClient } from "../supabase/server";
import type { ScoringConfig } from "@leads/db/types.js";

export async function listScoringConfig(): Promise<ScoringConfig[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("scoring_config").select("*").order("vertical", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
