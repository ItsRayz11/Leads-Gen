import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import type { Priority, TaskStatus } from "@leads/db/types.js";

interface TaskInput {
  leadId?: string;
  companyId?: string;
  contactId?: string;
  title: string;
  dueDate?: string;
  priority?: Priority;
}

export async function POST(req: NextRequest) {
  const input = (await req.json()) as TaskInput;
  if (!input.title?.trim()) {
    return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      lead_id: input.leadId ?? null,
      company_id: input.companyId ?? null,
      contact_id: input.contactId ?? null,
      title: input.title,
      due_date: input.dueDate || null,
      priority: input.priority ?? "normal",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function PATCH(req: NextRequest) {
  const { id, ...patch } = (await req.json()) as {
    id: string;
    status?: TaskStatus;
    title?: string;
    due_date?: string;
  };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
