import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { createClient } from "../../../lib/supabase/server";

interface ProviderConnectionInput {
  provider_name: string;
  category: "lead_data" | "ai";
  enabled?: boolean;
  priority?: number;
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const input = (await req.json()) as ProviderConnectionInput;
  if (!input.provider_name || !input.category) {
    return NextResponse.json({ error: "provider_name and category are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_connections")
    .upsert(
      {
        provider_name: input.provider_name,
        category: input.category,
        enabled: input.enabled ?? false,
        priority: input.priority ?? 0,
      },
      { onConflict: "provider_name" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ providerConnection: data });
}
