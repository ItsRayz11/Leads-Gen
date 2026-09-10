import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@leads/db/types.js";
import type { Vertical } from "@leads/core";
import {
  scoreLead,
  type DimensionWeights,
  type LeadDraft,
  type ScoreResult,
  type ScoreRule,
  type TierThreshold,
} from "../scoring/score.js";

/**
 * Rebuilds a lead's draft from lead_signals + evidence + contacts and
 * recomputes its dimension scores, overall score and tier. Shared by the
 * discovery pipeline (after new signals land) and contact enrichment (after a
 * named contact is added, since contactability is both a scored dimension and
 * a tier gate). Writes the leads.score/tier mirror columns and a new
 * lead_scores history row with the per-dimension scores and a
 * human-readable breakdown.
 *
 * The draft has to be rebuilt from what was *persisted*, not from what the
 * connector had in memory: `raw_payload` has been through JSON, so a date is
 * a string by now, and a signal's evidence URL lives on the `evidence` row it
 * points at rather than on the signal itself. Both are restored here so the
 * freshness and evidence rules can actually fire — before this they silently
 * never matched on a re-score, which is every score the app produces.
 */
export async function rescoreLead(
  supabase: SupabaseClient<Database>,
  leadId: string,
  vertical: Vertical,
  rules: ScoreRule[]
): Promise<{ score: number; tier: string }> {
  const [{ data: signalRows }, { data: evidenceRows }, { data: lead }, { data: config }] = await Promise.all([
    supabase.from("lead_signals").select("*").eq("lead_id", leadId),
    supabase.from("evidence").select("id, url").eq("lead_id", leadId),
    supabase.from("leads").select("company_id").eq("id", leadId).single(),
    supabase.from("scoring_config").select("dimension_weights, tier_thresholds").eq("vertical", vertical).maybeSingle(),
  ]);

  const evidenceUrlById = new Map(
    (evidenceRows ?? []).filter((e) => e.url).map((e) => [e.id, e.url as string])
  );

  const contactCount = lead?.company_id
    ? (await supabase.from("contacts").select("id", { count: "exact", head: true }).eq("company_id", lead.company_id))
        .count ?? 0
    : 0;

  const draft: LeadDraft = {
    vertical,
    projectName: "",
    hasNamedContact: contactCount > 0,
    signals: (signalRows ?? []).map((s) => {
      const meta = (s.raw_payload as Record<string, unknown>) ?? {};
      return {
        sourceConnector: s.source ?? "",
        vertical,
        projectName: "",
        signalText: s.signal_description,
        evidenceUrl: s.evidence_id ? evidenceUrlById.get(s.evidence_id) : undefined,
        discoveredAt: new Date(s.created_at),
        // signal_date is the persisted posting date, and the only one that
        // survives a round trip — raw_payload's copy is a string by now.
        meta: { ...meta, postedAt: s.signal_date ?? meta.postedAt },
        raw: s.raw_payload,
      };
    }),
  };

  // A missing row (a fresh database that hasn't run the seed migration, or a
  // vertical with no override yet) falls back to scoreLead's own defaults —
  // same behavior as before this table existed.
  const weights = config?.dimension_weights as DimensionWeights | undefined;
  const tierThresholds = config?.tier_thresholds as TierThreshold[] | undefined;
  const result = weights && tierThresholds ? scoreLead(draft, rules, weights, tierThresholds) : scoreLead(draft, rules);

  await supabase.from("leads").update({ score: result.score, tier: result.tier }).eq("id", leadId);
  await supabase.from("lead_scores").insert({
    lead_id: leadId,
    overall_score: result.score,
    tier: result.tier,
    ...dimensionColumns(result),
    tier_limited_by: result.tierLimitedBy,
    breakdown: result.matchedRules as unknown as Json,
  });

  return { score: result.score, tier: result.tier };
}

/**
 * Maps the dimension scores onto the columns lead_scores already had for
 * them. A dimension the vertical does not score stays null rather than 0 —
 * "not measured" and "measured as zero" are different facts.
 */
function dimensionColumns(result: ScoreResult) {
  return {
    intent_score: result.dimensions.intent,
    fit_score: result.dimensions.fit,
    evidence_score: result.dimensions.evidence,
    freshness_score: result.dimensions.freshness,
    contactability_score: result.dimensions.contactability,
    company_quality_score: result.dimensions.companyQuality,
  };
}
