import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import {
  buildLiveSearchPrompt,
  fetchJson,
  liveSearchResultsToSignals,
  parseLiveSearchResults,
  resolveApiKey,
} from "./shared.js";

const ENDPOINT_MODEL = "claude-sonnet-5";

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
    const apiKey = await resolveApiKey("ANTHROPIC_API_KEY", "anthropic");
    if (!apiKey) return [];

    const prompt = buildLiveSearchPrompt(config);

    const data = (await fetchJson(
      "https://api.anthropic.com/v1/messages",
      {
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
      },
      "Anthropic web search"
    )) as { content?: { type?: string; text?: string }[] };

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
