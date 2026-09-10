import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { testProviderConnection } from "../../../../lib/ai/client";

export async function POST(req: NextRequest) {
  const { id } = (await req.json()) as { id: string };
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const supabase = await createClient();
  const { data: setting, error: fetchError } = await supabase
    .from("ai_provider_settings")
    .select("provider, model")
    .eq("id", id)
    .single();

  if (fetchError || !setting) {
    return NextResponse.json({ error: fetchError?.message ?? "Setting not found." }, { status: 404 });
  }

  const result = await testProviderConnection(setting.provider, setting.model);

  await supabase
    .from("ai_provider_settings")
    .update({
      last_test_status: result.ok ? "ok" : "error",
      last_tested_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ ok: true });
}
