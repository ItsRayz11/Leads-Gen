import { createClient } from "../supabase/server";
import { callOpenAI, callAnthropic, callGoogle, callOpenRouter, type ProviderCallParams } from "./providers";

const ENV_KEY_BY_PROVIDER: Record<string, string | undefined> = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_AI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
};

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
  google: "gemini-2.0-flash",
  openrouter: "openai/gpt-4o-mini",
};

const CALL_BY_PROVIDER: Record<string, (params: ProviderCallParams) => Promise<string>> = {
  openai: callOpenAI,
  anthropic: callAnthropic,
  google: callGoogle,
  openrouter: callOpenRouter,
};

export function isProviderConfigured(provider: string): boolean {
  return Boolean(ENV_KEY_BY_PROVIDER[provider]);
}

export interface GenerateResult {
  text: string;
  provider: string;
  model: string;
}

export interface GenerateError {
  error: string;
}

/**
 * Picks the highest-priority enabled ai_provider_settings row for a use case
 * that also has its API key present in the environment, then calls it. Never
 * silently invents a provider — if nothing is configured, returns a
 * GenerateError the caller must surface honestly, not a fabricated draft.
 */
export async function generateText(useCase: string, prompt: string): Promise<GenerateResult | GenerateError> {
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("ai_provider_settings")
    .select("*")
    .eq("use_case", useCase)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  if (error) return { error: error.message };
  if (!settings || settings.length === 0) {
    return { error: `No AI provider is enabled for "${useCase.replace(/_/g, " ")}". Configure one in Settings.` };
  }

  const usable = settings.filter((s) => isProviderConfigured(s.provider));
  if (usable.length === 0) {
    return {
      error: `An AI provider is enabled for "${useCase.replace(/_/g, " ")}" but its API key isn't set in the environment.`,
    };
  }

  const setting = usable[0];
  const call = CALL_BY_PROVIDER[setting.provider];
  if (!call) return { error: `Unknown AI provider "${setting.provider}".` };

  const apiKey = ENV_KEY_BY_PROVIDER[setting.provider]!;
  const model = setting.model || DEFAULT_MODEL_BY_PROVIDER[setting.provider];

  try {
    const text = await call({ apiKey, model, prompt });
    return { text, provider: setting.provider, model };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI provider call failed." };
  }
}

export async function testProviderConnection(
  provider: string,
  model: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = ENV_KEY_BY_PROVIDER[provider];
  if (!apiKey) return { ok: false, error: "No API key set in the environment for this provider." };

  const call = CALL_BY_PROVIDER[provider];
  if (!call) return { ok: false, error: `Unknown provider "${provider}".` };

  try {
    await call({ apiKey, model: model || DEFAULT_MODEL_BY_PROVIDER[provider], prompt: "Reply with only the word: OK" });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connection test failed." };
  }
}
