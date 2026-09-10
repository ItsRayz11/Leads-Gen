import { fileURLToPath } from "node:url";
import { createServiceRoleClient } from "@leads/db";
import type { Vertical } from "@leads/core";
import { RULES_BY_VERTICAL } from "../scoring/rules-by-vertical.js";
import { rescoreLead } from "./rescore-lead.js";

/**
 * Re-scores every lead already on file against the current rule sets.
 *
 * Scores are only recomputed when something happens to a lead — new signals
 * land, or contact enrichment finds someone — so a change to the rules or to
 * the scorer leaves existing leads on their old numbers indefinitely. This is
 * the backfill for that.
 *
 * Human overrides are skipped: someone set those deliberately, and a rule
 * change is not a reason to overwrite a judgement call.
 */
export async function rescoreAllLeads(vertical?: Vertical): Promise<{ rescored: number; skipped: number }> {
  const supabase = createServiceRoleClient();

  let query = supabase.from("leads").select("id, vertical").order("created_at", { ascending: true });
  if (vertical) query = query.eq("vertical", vertical);

  const { data: leads, error } = await query;
  if (error) throw error;

  // One query for every lead that has ever been overridden, rather than one
  // per lead inside the loop.
  const { data: overrides } = await supabase
    .from("lead_scores")
    .select("lead_id")
    .eq("is_human_override", true);
  const overridden = new Set((overrides ?? []).map((row) => row.lead_id));

  let rescored = 0;
  let skipped = 0;

  for (const lead of leads ?? []) {
    if (overridden.has(lead.id)) {
      skipped++;
      continue;
    }

    const rules = RULES_BY_VERTICAL[lead.vertical as Vertical];
    if (!rules) {
      console.warn(`[rescore-all] lead ${lead.id} has unknown vertical "${lead.vertical}", skipping.`);
      skipped++;
      continue;
    }

    const { score, tier } = await rescoreLead(supabase, lead.id, lead.vertical as Vertical, rules);
    rescored++;
    if (rescored % 50 === 0) console.log(`[rescore-all] ${rescored} re-scored…`);
    if (rescored <= 5) console.log(`[rescore-all] lead ${lead.id}: [${score}] ${tier}`);
  }

  return { rescored, skipped };
}

async function main() {
  const vertical = process.argv[2] as Vertical | undefined;
  const { rescored, skipped } = await rescoreAllLeads(vertical);
  console.log(`Re-scored ${rescored} lead(s); skipped ${skipped} (human overrides or unknown vertical).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
