import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";
import {
  buildLiveSearchPrompt,
  createCooldownGuard,
  liveSearchResultsToSignals,
  parseLiveSearchResults,
} from "./shared.js";

const ENDPOINT_MODEL = "claude-sonnet-5";
const cooldown = createCooldownGuard();

async function resolveApiKey(): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  return getProviderSecret("anthropic");
}

/**
 * Anthropic counterpart to gemini-web-search.ts: uses Claude's server-side
 * `web_search` tool instead of Gemini's Google Search grounding. Same
 * prompt, same result shape, same downstream pipeline — only the API call
 * and response unwrapping differ.
 */
export const anthropicWebSearchConnector: SourceConnector = {
  name: "anthropic-web-search",
  vertical: ["live_search"],
  enabled: true,
  requiresApiKey: true,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const apiKey = await resolveApiKey();
    if (!apiKey) return [];
    if (cooldown.isCoolingDown(config)) {
      console.warn("[anthropic-web-search] skipped — same search ran within the cooldown window");
      return [];
    }
    cooldown.mark(config);

    const prompt = buildLiveSearchPrompt(config);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ENDPOINT_MODEL,
        max_tokens: 4096,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic web search error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { content?: { type?: string; text?: string }[] };
    // The response interleaves text blocks with server_tool_use/
    // web_search_tool_result blocks for the searches it ran along the way —
    // only the text blocks carry the model's actual final answer.
    const text = (data.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");
    const results = parseLiveSearchResults(text);
    return liveSearchResultsToSignals(results, "anthropic-web-search", config);
  },
};
