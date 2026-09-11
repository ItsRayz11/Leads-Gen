import { createClient } from "../supabase/server";
import { getProviderKeyStatus, type ProviderKeySource } from "./integrations";
import type { AiProviderSetting } from "@leads/db/types.js";
import type { AiUseCase } from "../ai-use-cases";

// Re-exported so existing server-side importers keep working; the
// definitions live in ../ai-use-cases so client components can use them too.
export {
  AI_USE_CASES,
  AI_USE_CASE_LABELS,
  AI_USE_CASE_UNASSIGNED_BEHAVIOUR,
  type AiUseCase,
} from "../ai-use-cases";

export async function listAiProviderSettings(): Promise<AiProviderSetting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_provider_settings")
    .select("*")
    .order("use_case", { ascending: true })
    .order("priority", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface UseCaseStatus {
  useCase: AiUseCase;
  /** True only when an enabled row for this use case also has a usable API key. */
  ready: boolean;
  provider: string | null;
  model: string | null;
  /** Why it isn't ready, when it isn't — distinguishes "nothing assigned" from "assigned but no key". */
  reason: "ready" | "not_assigned" | "no_key" | null;
}

/**
 * Mirrors exactly what generateText() in lib/ai/client.ts will do for a use
 * case: take the enabled rows in priority order, and use the first one whose
 * provider has a resolvable key. Kept in sync deliberately — this is what
 * lets the UI say "AI ready" or "will fall back" truthfully instead of
 * guessing.
 */
export function resolveUseCaseStatus(
  useCase: AiUseCase,
  settings: AiProviderSetting[],
  keyStatus: Record<string, ProviderKeySource>
): UseCaseStatus {
  const candidates = settings
    .filter((s) => s.use_case === useCase && s.enabled)
    .sort((a, b) => a.priority - b.priority);

  if (candidates.length === 0) {
    return { useCase, ready: false, provider: null, model: null, reason: "not_assigned" };
  }

  const usable = candidates.find((s) => keyStatus[s.provider] && keyStatus[s.provider] !== "none");
  if (!usable) {
    return { useCase, ready: false, provider: candidates[0].provider, model: candidates[0].model, reason: "no_key" };
  }

  return { useCase, ready: true, provider: usable.provider, model: usable.model, reason: "ready" };
}

export async function getUseCaseStatus(useCase: AiUseCase): Promise<UseCaseStatus> {
  const [settings, keyStatus] = await Promise.all([listAiProviderSettings(), getProviderKeyStatus()]);
  return resolveUseCaseStatus(useCase, settings, keyStatus);
}
