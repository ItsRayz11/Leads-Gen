import { createLiveSearchConnector } from "./shared.js";

const ENDPOINT_MODEL = "claude-sonnet-5";

/**
 * The response interleaves text blocks with server_tool_use/
 * web_search_tool_result blocks for the searches it ran along the way — only
 * the text blocks carry the model's actual final answer.
 */
function extractText(data: { content?: { type?: string; text?: string }[] }): string {
  return (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}

/**
 * Anthropic counterpart to gemini-web-search.ts: uses Claude's server-side
 * `web_search` tool instead of Gemini's Google Search grounding. Same
 * prompt, same result shape, same downstream pipeline (see shared.ts's
 * createLiveSearchConnector) — only the request shape and response
 * unwrapping differ.
 */
export const anthropicWebSearchConnector = createLiveSearchConnector({
  provider: "anthropic",
  buildRequest(apiKey, prompt) {
    return {
      url: "https://api.anthropic.com/v1/messages",
      init: {
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
    };
  },
  extractText,
});
