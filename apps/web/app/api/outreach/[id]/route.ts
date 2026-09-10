import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import type { OutreachStatus } from "@leads/db/types.js";

const VALID_STATUSES: OutreachStatus[] = ["draft", "sent", "replied", "no_response", "bounced"];

interface OutreachPatch {
  status?: OutreachStatus;
  result?: string | null;
  followUpDate?: string | null;
}

const RESULT_ACTIVITY: Record<OutreachStatus, string | null> = {
  draft: null,
  sent: "contacted",
  replied: "reply",
  no_response: "outreach_result",
  bounced: "outreach_result",
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patch = (await req.json()) as OutreachPatch;

  if (patch.status && !VALID_STATUSES.includes(patch.status)) {
    return NextResponse.json({ error: `Unknown outreach status "${patch.status}".` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("outreach")
    .select("id, lead_id, channel, recipient, status, sent_at")
    .eq("id", id)
    .single();

  if (loadError || !existing) {
    return NextResponse.json({ error: "Outreach record not found." }, { status: 404 });
  }

  const update: {
    status?: OutreachStatus;
    result?: string | null;
    follow_up_date?: string | null;
    sent_at?: string | null;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if (patch.status) update.status = patch.status;
  if (patch.result !== undefined) update.result = patch.result?.trim() || null;
  if (patch.followUpDate !== undefined) update.follow_up_date = patch.followUpDate || null;

  // A record only gets a sent_at once it leaves draft, and it keeps the
  // original timestamp on every later result change.
  if (patch.status && patch.status !== "draft" && !existing.sent_at) {
    update.sent_at = new Date().toISOString();
  }
  if (patch.status === "draft") update.sent_at = null;

  const { data, error } = await supabase
    .from("outreach")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const changedStatus = patch.status && patch.status !== existing.status ? patch.status : null;
  if (changedStatus) {
    const activityType = RESULT_ACTIVITY[changedStatus];
    if (activityType) {
      const target = existing.recipient ? ` (${existing.recipient})` : "";
      await supabase.from("activities").insert({
        lead_id: existing.lead_id,
        type: activityType,
        description:
          changedStatus === "replied"
            ? `Reply received on ${existing.channel} outreach${target}`
            : `${existing.channel} outreach marked ${changedStatus.replace(/_/g, " ")}${target}`,
      });
    }
  }

  const leadUpdate: { next_follow_up_at?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.followUpDate !== undefined) leadUpdate.next_follow_up_at = patch.followUpDate || null;
  await supabase.from("leads").update(leadUpdate).eq("id", existing.lead_id);

  return NextResponse.json({ outreach: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("outreach").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
