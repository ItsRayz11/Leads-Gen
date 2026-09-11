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

/**
 * Assigns a provider (+ optional model) to a use case: one clean upsert
 * instead of the POST route's plain insert, which would otherwise pile up a
 * duplicate row every time the same use case is reassigned. This is what the
 * Settings page's task-routing picker calls — POST above stays for the
 * advanced multi-provider-fallback table.
 */
export async function PUT(req: NextRequest) {
  const input = (await req.json()) as {
    provider: string;
    use_case: string;
    model?: string | null;
    enabled?: boolean;
    priority?: number;
  };
  if (!input.provider?.trim() || !input.use_case?.trim()) {
    return NextResponse.json({ error: "provider and use_case are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_provider_settings")
    .upsert(
      {
        provider: input.provider,
        use_case: input.use_case,
        model: input.model || null,
        enabled: input.enabled ?? true,
        priority: input.priority ?? 0,
      },
      { onConflict: "use_case,provider" }
    )
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
