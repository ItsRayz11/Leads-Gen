import { createClient } from "../supabase/server";
import type { AiProviderSetting } from "@leads/db/types.js";

export async function listAiProviderSettings(): Promise<AiProviderSetting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_provider_settings")
    .select("*")
    .order("use_case", { ascending: true })
    .order("priority", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
