import { createClient } from "../supabase/server";
import type { ProviderConnection } from "@leads/db/types.js";

export async function listProviderConnections(): Promise<ProviderConnection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_connections")
    .select("*")
    .order("category", { ascending: true })
    .order("priority", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface EnvConfiguredProviders {
  web3_career: boolean;
  twitterapi_io: boolean;
  hunter: boolean;
  apollo: boolean;
  prospeo: boolean;
  pdl: boolean;
  openai: boolean;
  anthropic: boolean;
  google: boolean;
  openrouter: boolean;
}

export function getEnvConfiguredProviders(): EnvConfiguredProviders {
  return {
    web3_career: !!process.env.WEB3_CAREER_API_TOKEN,
    twitterapi_io: !!process.env.TWITTERAPI_IO_KEY,
    hunter: !!process.env.HUNTER_API_KEY,
    apollo: !!process.env.APOLLO_API_KEY,
    prospeo: !!process.env.PROSPEO_API_KEY,
    pdl: !!process.env.PDL_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    google: !!process.env.GOOGLE_AI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };
}
