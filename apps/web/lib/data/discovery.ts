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
