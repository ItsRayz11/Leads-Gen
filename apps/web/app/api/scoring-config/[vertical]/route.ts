import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import type { Database } from "@leads/db/types.js";

type ScoringConfigUpdate = Database["public"]["Tables"]["scoring_config"]["Update"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ vertical: string }> }) {
  const { vertical } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: ScoringConfigUpdate = {};
  if (body.dimension_weights && typeof body.dimension_weights === "object" && !Array.isArray(body.dimension_weights)) {
    patch.dimension_weights = body.dimension_weights;
  }
  if (Array.isArray(body.tier_thresholds)) {
    patch.tier_thresholds = body.tier_thresholds;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("scoring_config").update(patch).eq("vertical", vertical);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
