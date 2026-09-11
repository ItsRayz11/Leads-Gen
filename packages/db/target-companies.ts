import { createServiceRoleClient } from "./client.js";
import type { Json, TargetCompany, TargetCompanySource } from "./types.js";

export type { TargetCompany, TargetCompanySource };

/**
 * All rows for one connector, newest first — used both by the workers
 * pipeline (to know which companies to check) and the Integrations page (to
 * list/manage them). Fails open (empty array) rather than breaking a
 * connector run or the Integrations page when the service-role env vars
 * aren't set — see the fallback to the JSON config file in
 * workers/target-companies.ts, and getSecretStore's identical reasoning.
 */
export async function listTargetCompanies(source: TargetCompanySource): Promise<TargetCompany[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("target_companies")
      .select("*")
      .eq("source", source)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.warn(`[target-companies] could not list "${source}": ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

export async function addTargetCompany(input: {
  source: TargetCompanySource;
  identifier: string;
  label?: string | null;
  extra?: Record<string, unknown> | null;
}): Promise<TargetCompany> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("target_companies")
    .upsert(
      {
        source: input.source,
        identifier: input.identifier.trim(),
        label: input.label?.trim() || null,
        extra: (input.extra as Json) ?? null,
        enabled: true,
      },
      { onConflict: "source,identifier" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeTargetCompany(id: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("target_companies").delete().eq("id", id);
  if (error) throw error;
}

export async function setTargetCompanyEnabled(id: string, enabled: boolean): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("target_companies").update({ enabled }).eq("id", id);
  if (error) throw error;
}
