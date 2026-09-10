import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

interface AiProviderSettingInput {
  provider: string;
  model?: string;
  use_case?: string;
  enabled?: boolean;
  priority?: number;
}

export async function POST(req: NextRequest) {
  const input = (await req.json()) as AiProviderSettingInput;
  if (!input.provider?.trim()) {
    return NextResponse.json({ error: "provider is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_provider_settings")
    .insert({
      provider: input.provider,
      model: input.model || null,
      use_case: input.use_case || null,
      enabled: input.enabled ?? false,
      priority: input.priority ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ aiProviderSetting: data });
}

export async function PATCH(req: NextRequest) {
  const { id, ...patch } = (await req.json()) as {
    id: string;
    model?: string;
    use_case?: string;
    enabled?: boolean;
    priority?: number;
  };
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("ai_provider_settings").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
