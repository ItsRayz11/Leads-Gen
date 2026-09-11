import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/api-auth";
import { createClient } from "../../../../lib/supabase/server";
import { buildLeadPatch } from "../../../../lib/data/lead-patch";
import type { VerificationStatus } from "@leads/db/types.js";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const patch = buildLeadPatch(body);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (patch.status) {
    await supabase.from("activities").insert({
      lead_id: id,
      type: "status_change",
      description: `Status changed to ${String(patch.status).replace(/_/g, " ")}`,
    });
  }

  if (patch.verification_status) {
    const verification = patch.verification_status as VerificationStatus;
    const note = typeof body.verificationNote === "string" ? body.verificationNote.trim() : "";

    // Marking a lead verified means its evidence was actually checked, so
    // the evidence rows get the timestamp that proves when.
    if (verification === "verified") {
      await supabase
        .from("evidence")
        .update({ verified_at: new Date().toISOString() })
        .eq("lead_id", id)
        .is("verified_at", null);
    }

    await supabase.from("activities").insert({
      lead_id: id,
      type: "verification",
      description: `Verification set to ${verification.replace(/_/g, " ")}${note ? ` — ${note}` : ""}`,
    });
  }

  return NextResponse.json({ ok: true });
}
