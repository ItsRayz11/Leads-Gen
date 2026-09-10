import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

interface NoteInput {
  leadId?: string;
  companyId?: string;
  contactId?: string;
  body: string;
}

export async function POST(req: NextRequest) {
  const input = (await req.json()) as NoteInput;
  if (!input.body?.trim()) {
    return NextResponse.json({ error: "Note body is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("notes")
    .insert({
      lead_id: input.leadId ?? null,
      company_id: input.companyId ?? null,
      contact_id: input.contactId ?? null,
      body: input.body,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (input.leadId) {
    await supabase.from("activities").insert({
      lead_id: input.leadId,
      type: "note",
      description: input.body.slice(0, 140),
    });
  }

  return NextResponse.json({ note: data });
}
