import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/api-auth";
import { createClient } from "../../../../../lib/supabase/server";
import type { Json, LeadTier } from "@leads/db/types.js";

const VALID_TIERS: LeadTier[] = ["A+", "A", "B", "C", "Low Priority"];

interface OverrideInput {
  score?: number | string;
  tier?: LeadTier | "";
  reason?: string;
}

/**
 * Records a human score/tier override. The override is written as a new
 * `lead_scores` row flagged `is_human_override` rather than by editing the
 * computed one, so the machine score stays on file and a re-run of the
 * pipeline is visibly a different judgement, not a lost one.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const input = (await req.json()) as OverrideInput;

  const rawScore = typeof input.score === "string" ? parseInt(input.score, 10) : input.score;
  if (rawScore == null || !Number.isFinite(rawScore)) {
    return NextResponse.json({ error: "A score between 0 and 100 is required." }, { status: 400 });
  }
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const tier = input.tier?.trim() ? (input.tier.trim() as LeadTier) : null;
  if (tier && !VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: `Unknown tier "${tier}".` }, { status: 400 });
  }

  const reason = input.reason?.trim();
  if (!reason) {
    return NextResponse.json(
      { error: "A reason is required — an override without one is indistinguishable from a mistake." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: lead, error: loadError } = await supabase
    .from("leads")
    .select("id, score, tier")
    .eq("id", id)
    .single();
  if (loadError || !lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const { error: scoreError } = await supabase.from("lead_scores").insert({
    lead_id: id,
    overall_score: score,
    tier,
    is_human_override: true,
    override_reason: reason,
    breakdown: [
      {
        label: `Human override (was ${lead.score}${lead.tier ? ` / ${lead.tier}` : ""})`,
        points: score,
      },
    ] as unknown as Json,
  });
  if (scoreError) return NextResponse.json({ error: scoreError.message }, { status: 500 });

  const { error: leadError } = await supabase
    .from("leads")
    .update({ score, tier, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });

  await supabase.from("activities").insert({
    lead_id: id,
    type: "score_override",
    description: `Score set by hand to ${score}${tier ? ` (${tier})` : ""} — ${reason}`,
    metadata: {
      previous_score: lead.score,
      previous_tier: lead.tier,
      new_score: score,
      new_tier: tier,
      reason,
    } as unknown as Json,
  });

  return NextResponse.json({ ok: true, score, tier });
}
