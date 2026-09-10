import { createServiceRoleClient } from "@leads/db";

/**
 * The `provider_connections.provider_name` values that gate a connector.
 * AI providers are deliberately absent: which model handles which task is
 * driven by `ai_provider_settings` (Settings page), not by this table.
 */
export type GatedProvider = "web3_career" | "twitterapi_io" | "hunter" | "apollo" | "prospeo";

let disabledProviders: Promise<Set<string>> | null = null;
const announced = new Set<string>();

async function loadDisabledProviders(): Promise<Set<string>> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("provider_connections")
      .select("provider_name, enabled")
      .eq("category", "lead_data");
    if (error) throw error;

    return new Set((data ?? []).filter((row) => !row.enabled).map((row) => row.provider_name));
  } catch (err) {
    // These toggles are a cost control, not a kill switch. If the table can't
    // be read, fall back to the pre-toggle behaviour (env key present = the
    // provider runs) rather than halting a scheduled run.
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[provider-gate] could not read provider_connections (${reason}); treating all providers as enabled.`);
    return new Set();
  }
}

/**
 * True unless the Integrations page holds an explicit `enabled = false` row
 * for this provider. A missing row counts as enabled, so a database that
 * hasn't run the seed migration behaves the way it did before the toggle was
 * wired up. The lookup is cached per process: one query per worker run, not
 * one per lead.
 */
export async function isProviderEnabled(provider: GatedProvider): Promise<boolean> {
  disabledProviders ??= loadDisabledProviders();
  const enabled = !(await disabledProviders).has(provider);

  if (!enabled && !announced.has(provider)) {
    announced.add(provider);
    console.warn(`[provider-gate] ${provider} is switched off on the Integrations page, skipping it.`);
  }
  return enabled;
}

/** Clears the per-process cache. Exists for tests. */
export function resetProviderGateCache(): void {
  disabledProviders = null;
  announced.clear();
}
