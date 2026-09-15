import { getSecretStore } from "@leads/db/secrets.js";
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

export type ProviderKeySource = "env" | "database" | "none";

const ENV_VAR_BY_PROVIDER: Record<string, string> = {
  web3_career: "WEB3_CAREER_API_TOKEN",
  twitterapi_io: "TWITTERAPI_IO_KEY",
  hunter: "HUNTER_API_KEY",
  apollo: "APOLLO_API_KEY",
  prospeo: "PROSPEO_API_KEY",
  pdl: "PDL_API_KEY",
  serper: "SERPER_API_KEY",
  decodo: "DECODO_USERNAME",
  firecrawl: "FIRECRAWL_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  agentrouter: "AGENTROUTER_API_KEY",
};

/**
 * Where each provider's key currently comes from, if anywhere — an env var
 * takes priority (matches lib/ai/client.ts's resolveApiKey), otherwise a row
 * in provider_secrets entered from the Integrations page, otherwise none.
 */
export async function getProviderKeyStatus(): Promise<Record<string, ProviderKeySource>> {
  return (await getProviderKeyReport()).status;
}

export interface ProviderKeyReport {
  status: Record<string, ProviderKeySource>;
  /**
   * Set when the database-backed key store couldn't be read at all. Without
   * this, a missing SUPABASE_SERVICE_ROLE_KEY makes every stored key report
   * as "none" — indistinguishable from never having entered one, which is
   * what makes this failure so hard to diagnose from the UI.
   */
  storeUnavailable: string | null;
}

/** The same status, plus why the stored-key half of it may be empty. */
export async function getProviderKeyReport(): Promise<ProviderKeyReport> {
  const { providers: dbConfigured, unavailable } = await getSecretStore();
  const status: Record<string, ProviderKeySource> = {};
  for (const [provider, envVar] of Object.entries(ENV_VAR_BY_PROVIDER)) {
    if (process.env[envVar]) status[provider] = "env";
    else if (dbConfigured.has(provider)) status[provider] = "database";
    else status[provider] = "none";
  }
  return { status, storeUnavailable: unavailable };
}
