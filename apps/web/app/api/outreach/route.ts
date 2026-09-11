import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { createClient } from "../../../lib/supabase/server";
import type { OutreachStatus } from "@leads/db/types.js";

interface OutreachInput {
  leadId: string;
  contactId?: string;
  channel: string;
  message?: string;
  recipient?: string;
  status?: OutreachStatus;
  result?: string;
  followUpDate?: string;
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const input = (await req.json()) as OutreachInput;
  if (!input.leadId || !input.channel) {
    return NextResponse.json({ error: "leadId and channel are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const status = input.status ?? "sent";
  // Anything that isn't a draft has actually left, so it gets a sent_at —
  // including a record logged straight in as replied/no_response/bounced.
  const sentAt = status === "draft" ? null : new Date().toISOString();

  const { data, error } = await supabase
    .from("outreach")
    .insert({
      lead_id: input.leadId,
      contact_id: input.contactId ?? null,
      channel: input.channel,
      message: input.message ?? null,
      recipient: input.recipient ?? null,
      result: input.result?.trim() || null,
      status,
      sent_at: sentAt,
      follow_up_date: input.followUpDate || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status !== "draft") {
    await supabase.from("activities").insert({
      lead_id: input.leadId,
      type: input.channel === "email" ? "email" : "contacted",
      description: `Outreach via ${input.channel}${input.recipient ? ` to ${input.recipient}` : ""}`,
    });

    const leadUpdate: { last_contacted_at: string; next_follow_up_at?: string } = {
      last_contacted_at: new Date().toISOString(),
    };
    if (input.followUpDate) leadUpdate.next_follow_up_at = input.followUpDate;
    await supabase.from("leads").update(leadUpdate).eq("id", input.leadId);
  } else if (input.followUpDate) {
    await supabase.from("leads").update({ next_follow_up_at: input.followUpDate }).eq("id", input.leadId);
  }

  return NextResponse.json({ outreach: data });
}
