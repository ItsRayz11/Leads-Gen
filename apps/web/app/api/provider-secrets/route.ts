import { NextRequest, NextResponse } from "next/server";
import { setProviderSecret, deleteProviderSecret } from "@leads/db/secrets.js";
import { createClient } from "../../../lib/supabase/server";

const KNOWN_PROVIDERS = new Set([
  "web3_career",
  "twitterapi_io",
  "hunter",
  "apollo",
  "prospeo",
  "pdl",
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "agentrouter",
]);

async function requireUser(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

interface ProviderSecretInput {
  provider: string;
  category: "lead_data" | "ai";
  value: string;
}

export async function POST(req: NextRequest) {
  if (!(await requireUser(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const input = (await req.json().catch(() => ({}))) as Partial<ProviderSecretInput>;
  if (!input.provider || !KNOWN_PROVIDERS.has(input.provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }
  if (!input.category || (input.category !== "lead_data" && input.category !== "ai")) {
    return NextResponse.json({ error: "category must be lead_data or ai." }, { status: 400 });
  }
  if (!input.value || !input.value.trim()) {
    return NextResponse.json({ error: "value is required." }, { status: 400 });
  }

  try {
    await setProviderSecret(input.provider, input.category, input.value.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save key." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireUser(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const input = (await req.json().catch(() => ({}))) as { provider?: string };
  if (!input.provider || !KNOWN_PROVIDERS.has(input.provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }

  try {
    await deleteProviderSecret(input.provider);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to remove key." }, { status: 500 });
  }
}
