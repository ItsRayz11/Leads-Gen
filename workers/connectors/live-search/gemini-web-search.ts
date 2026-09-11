import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";
import {
  buildLiveSearchPrompt,
  createCooldownGuard,
  liveSearchResultsToSignals,
  parseLiveSearchResults,
} from "./shared.js";

const ENDPOINT_MODEL = "gemini-3.6-flash";
const cooldown = createCooldownGuard();

/** Env var first (fast path, matches apps/web/lib/ai/client.ts), else the encrypted Integrations-page key. */
async function resolveApiKey(): Promise<string | null> {
  if (process.env.GOOGLE_AI_API_KEY) return process.env.GOOGLE_AI_API_KEY;
  return getProviderSecret("google");
}

/**
 * Runs one live, grounded Google search via the Gemini API and turns whatever
 * it finds into signals — one of three provider-specific live-search
 * connectors (see openai-web-search.ts, anthropic-web-search.ts) a
 * live_search config can select between. See run-vertical4-live-search.ts for
 * how its results reach the same dedupe/scoring/upsert pipeline as every
 * other vertical.
 *
 * Requires a Google AI (Gemini) API key — the same one search interpretation
 * already uses (env `GOOGLE_AI_API_KEY` or the Integrations page). Grounding
 * is a Gemini-specific feature, so this bypasses the multi-provider
 * ai_provider_settings routing and always calls Google directly.
 */
export const geminiWebSearchConnector: SourceConnector = {
  name: "gemini-web-search",
  vertical: ["live_search"],
  enabled: true,
  requiresApiKey: true,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const apiKey = await resolveApiKey();
    if (!apiKey) return [];
    if (cooldown.isCoolingDown(config)) {
      console.warn("[gemini-web-search] skipped — same search ran within the cooldown window");
      return [];
    }
    cooldown.mark(config);

    const prompt = buildLiveSearchPrompt(config);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${ENDPOINT_MODEL}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini web search error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const results = parseLiveSearchResults(text);
    return liveSearchResultsToSignals(results, "gemini-web-search", config);
  },
};
