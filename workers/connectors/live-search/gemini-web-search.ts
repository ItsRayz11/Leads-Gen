import { createLiveSearchConnector } from "./shared.js";

const ENDPOINT_MODEL = "gemini-3.6-flash";

/**
 * Runs one live, grounded Google search via the Gemini API and turns whatever
 * it finds into signals — one of three provider-specific live-search
 * connectors (see openai-web-search.ts, anthropic-web-search.ts) a
 * live_search config can select between. See run-vertical4-live-search.ts for
 * how its results reach the same dedupe/scoring/upsert pipeline as every
 * other vertical, and shared.ts's createLiveSearchConnector for the fetch/
 * parse/signal-mapping logic every provider connector shares (including
 * where its connector name and API key come from — LIVE_SEARCH_PROVIDER_INFO
 * in shared.ts, not repeated here).
 *
 * Grounding is a Gemini-specific feature, so this bypasses the multi-provider
 * ai_provider_settings routing and always calls Google directly.
 */
export const geminiWebSearchConnector = createLiveSearchConnector({
  provider: "google",
  buildRequest(apiKey, prompt) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${ENDPOINT_MODEL}:generateContent?key=${apiKey}`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2 },
        }),
      },
    };
  },
  extractText(data: { candidates?: { content?: { parts?: { text?: string }[] } }[] }) {
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  },
});
