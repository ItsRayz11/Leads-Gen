import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import {
  buildLiveSearchPrompt,
  fetchJson,
  liveSearchResultsToSignals,
  parseLiveSearchResults,
  resolveApiKey,
} from "./shared.js";

const ENDPOINT_MODEL = "gpt-4o-mini";

/** Concatenates every output_text chunk from a Responses API result — the raw JSON has no `output_text` convenience field, unlike the SDK. */
function extractOutputText(data: {
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
}): string {
  const chunks: string[] = [];
  for (const item of data.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("");
}

/**
 * OpenAI counterpart to gemini-web-search.ts: uses the Responses API's
 * built-in `web_search` tool instead of Gemini's Google Search grounding.
 * Same prompt, same result shape, same downstream pipeline — only the API
 * call and response unwrapping differ, because each provider's web-search
 * tool has its own request/response shape.
 */
export const openaiWebSearchConnector: SourceConnector = {
  name: "openai-web-search",
  vertical: ["live_search"],
  enabled: true,
  requiresApiKey: true,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const apiKey = await resolveApiKey("OPENAI_API_KEY", "openai");
    if (!apiKey) return [];

    const prompt = buildLiveSearchPrompt(config);

    const data = (await fetchJson(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ENDPOINT_MODEL,
          input: prompt,
          tools: [{ type: "web_search" }],
          temperature: 0.2,
        }),
      },
      "OpenAI web search"
    )) as { output?: { type?: string; content?: { type?: string; text?: string }[] }[] };

    const text = extractOutputText(data);
    const results = parseLiveSearchResults(text);
    return liveSearchResultsToSignals(results, "openai-web-search", config);
  },
};
