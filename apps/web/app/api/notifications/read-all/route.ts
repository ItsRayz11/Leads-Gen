import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
