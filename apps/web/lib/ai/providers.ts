export interface ProviderCallParams {
  apiKey: string;
  model: string;
  prompt: string;
}

async function parseErrorBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return text.slice(0, 300);
}

export async function callOpenAI({ apiKey, model, prompt }: ProviderCallParams): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.4 }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await parseErrorBody(res)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("OpenAI response did not include message text.");
  return text;
}

export async function callAnthropic({ apiKey, model, prompt }: ProviderCallParams): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await parseErrorBody(res)}`);
  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("Anthropic response did not include message text.");
  return text;
}

export async function callGoogle({ apiKey, model, prompt }: ProviderCallParams): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Google AI error ${res.status}: ${await parseErrorBody(res)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("Google AI response did not include message text.");
  return text;
}

/**
 * Any OpenAI-compatible chat-completions proxy — same request/response shape
 * as OpenAI itself, just a different base URL. OpenRouter and AgentRouter
 * both fit this without needing their own bespoke parsing.
 */
export async function callOpenAICompatible({
  apiKey,
  baseUrl,
  model,
  prompt,
}: ProviderCallParams & { baseUrl: string }): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`${baseUrl} error ${res.status}: ${await parseErrorBody(res)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error(`${baseUrl} response did not include message text.`);
  return text;
}

export async function callOpenRouter(params: ProviderCallParams): Promise<string> {
  return callOpenAICompatible({ ...params, baseUrl: "https://openrouter.ai/api/v1" });
}

/** https://agentrouter.org — OpenAI-compatible proxy in front of multiple hosted models under one key. */
export async function callAgentRouter(params: ProviderCallParams): Promise<string> {
  return callOpenAICompatible({ ...params, baseUrl: "https://agentrouter.org/v1" });
}
