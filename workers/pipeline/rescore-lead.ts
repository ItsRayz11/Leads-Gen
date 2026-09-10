import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@leads/db/types.js";
import type { Vertical } from "@leads/core";
import { scoreLead, type LeadDraft, type ScoreRule } from "../scoring/score.js";

/**
 * Rebuilds a lead's draft from lead_signals + contacts and recomputes
 * score/tier. Shared by the discovery pipeline (after new signals land) and
 * contact enrichment (after a named contact is added, since "named contact
 * found" is itself a scoring rule in every vertical). Writes both the
 * leads.score/tier mirror columns and a new lead_scores history row with a
 * human-readable breakdown.
 */
export async function rescoreLead(
  supabase: SupabaseClient<Database>,
  leadId: string,
  vertical: Vertical,
  rules: ScoreRule[]
): Promise<{ score: number; tier: string }> {
  const [{ data: signalRows }, { data: lead }] = await Promise.all([
    supabase.from("lead_signals").select("*").eq("lead_id", leadId),
    supabase.from("leads").select("company_id").eq("id", leadId).single(),
  ]);

  const contactCount = lead?.company_id
    ? (await supabase.from("contacts").select("id", { count: "exact", head: true }).eq("company_id", lead.company_id))
        .count ?? 0
    : 0;

  const draft: LeadDraft = {
    vertical,
    projectName: "",
    hasNamedContact: contactCount > 0,
    signals: (signalRows ?? []).map((s) => ({
      sourceConnector: s.source ?? "",
      vertical,
      projectName: "",
      signalText: s.signal_description,
      evidenceUrl: undefined,
      discoveredAt: new Date(s.created_at),
      meta: (s.raw_payload as Record<string, unknown>) ?? {},
      raw: s.raw_payload,
    })),
  };

  const { score, tier, matchedRules } = scoreLead(draft, rules);

  await supabase.from("leads").update({ score, tier }).eq("id", leadId);
  await supabase.from("lead_scores").insert({
    lead_id: leadId,
    overall_score: score,
    tier,
    breakdown: matchedRules,
  });

  return { score, tier };
}
