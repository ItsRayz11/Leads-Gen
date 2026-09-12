import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import {
  buildLiveSearchPrompt,
  fetchJson,
  liveSearchResultsToSignals,
  parseLiveSearchResults,
  resolveApiKey,
} from "./shared.js";

const ENDPOINT_MODEL = "gemini-3.6-flash";

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
    const apiKey = await resolveApiKey("GOOGLE_AI_API_KEY", "google");
    if (!apiKey) return [];

    const prompt = buildLiveSearchPrompt(config);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${ENDPOINT_MODEL}:generateContent?key=${apiKey}`;

    const data = (await fetchJson(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2 },
        }),
      },
      "Gemini web search"
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const results = parseLiveSearchResults(text);
    return liveSearchResultsToSignals(results, "gemini-web-search", config);
  },
};
