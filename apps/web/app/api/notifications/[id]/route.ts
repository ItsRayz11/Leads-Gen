import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/api-auth";
import { createClient } from "../../../../lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const read = typeof body.read === "boolean" ? body.read : true;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notification: data });
}
