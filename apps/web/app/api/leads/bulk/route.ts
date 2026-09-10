import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { BULK_EDITABLE_FIELDS, buildLeadPatch } from "../../../../lib/data/lead-patch";
import type { VerificationStatus } from "@leads/db/types.js";

/**
 * One bulk edit is one UPDATE plus one activities INSERT, so the ceiling is
 * about how much a single mistaken click should be able to change, not about
 * query size. 500 is a page of leads several times over.
 */
const MAX_IDS = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BulkBody {
  ids?: unknown;
  patch?: unknown;
}

/**
 * Applies one field change to many leads at once — the /leads table's bulk
 * action bar. Deliberately narrower than PATCH /api/leads/[id]: see
 * BULK_EDITABLE_FIELDS for which columns a bulk edit may touch and why.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as BulkBody;

  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.filter((id): id is string => typeof id === "string" && UUID.test(id))))
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one lead." }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Too many leads in one edit (${ids.length}); the limit is ${MAX_IDS}.` },
      { status: 400 }
    );
  }

  const rawPatch =
    body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
      ? (body.patch as Record<string, unknown>)
      : {};
  const patch = buildLeadPatch(rawPatch, BULK_EDITABLE_FIELDS);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update — that field can't be set in bulk." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const updatedIds = (data ?? []).map((row) => row.id);

  // Same rule as the single-lead route: marking leads verified means their
  // evidence was actually checked, so the evidence rows get the timestamp
  // that proves when.
  if (patch.verification_status === "verified" && updatedIds.length > 0) {
    await supabase
      .from("evidence")
      .update({ verified_at: new Date().toISOString() })
      .in("lead_id", updatedIds)
      .is("verified_at", null);
  }

  // The timeline is what makes a bulk change auditable afterwards — without a
  // row per lead, twenty leads would silently change status with no record of
  // when or to what.
  const activities: { lead_id: string; type: string; description: string }[] = [];
  for (const leadId of updatedIds) {
    if (patch.status) {
      activities.push({
        lead_id: leadId,
        type: "status_change",
        description: `Status changed to ${String(patch.status).replace(/_/g, " ")} (bulk edit of ${updatedIds.length} leads)`,
      });
    }
    if (patch.verification_status) {
      const verification = patch.verification_status as VerificationStatus;
      activities.push({
        lead_id: leadId,
        type: "verification",
        description: `Verification set to ${verification.replace(/_/g, " ")} (bulk edit of ${updatedIds.length} leads)`,
      });
    }
  }

  if (activities.length > 0) {
    const { error: activityError } = await supabase.from("activities").insert(activities);
    if (activityError) {
      // The leads are already updated; report the gap rather than pretending
      // the timeline is complete.
      return NextResponse.json({
        updated: updatedIds.length,
        warning: `Leads updated, but the activity timeline was not written: ${activityError.message}`,
      });
    }
  }

  return NextResponse.json({ updated: updatedIds.length });
}
