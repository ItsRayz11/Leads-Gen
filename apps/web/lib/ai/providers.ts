export interface ProviderCallParams {
  apiKey: string;
  model: string;
  prompt: string;
  /** Lower = more consistent/deterministic (structured extraction), higher = more varied (creative writing). */
  temperature: number;
}

async function parseErrorBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return text.slice(0, 300);
}

/**
 * A provider can answer with a 2xx status but a non-JSON body — a proxy
 * outage page, a CDN challenge page, etc. `res.json()` on that throws an
 * opaque `SyntaxError: Unexpected token '<'...` that's meaningless to a user.
 * Check content-type first so a bad response fails with a message that says
 * what actually happened.
 */
async function parseJsonResponse(res: Response, label: string): Promise<any> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const body = await parseErrorBody(res);
    throw new Error(
      `${label} returned a non-JSON response (status ${res.status}, content-type "${contentType || "unknown"}"): ${body}`
    );
  }
  return res.json();
}

export async function callOpenAI({ apiKey, model, prompt, temperature }: ProviderCallParams): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await parseErrorBody(res)}`);
  const data = await parseJsonResponse(res, "OpenAI");
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("OpenAI response did not include message text.");
  return text;
}

export async function callAnthropic({ apiKey, model, prompt, temperature }: ProviderCallParams): Promise<string> {
  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };
  const call = (includeTemperature: boolean) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        ...(includeTemperature ? { temperature } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
    });

  let res = await call(true);
  if (!res.ok) {
    const body = await parseErrorBody(res);
    // Claude 5 family models reject `temperature` outright ("`temperature` is
    // deprecated for this model") — retry once without it rather than failing
    // every call for a param older models accept fine.
    if (res.status === 400 && /temperature/i.test(body) && /deprecated/i.test(body)) {
      res = await call(false);
      if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await parseErrorBody(res)}`);
    } else {
      throw new Error(`Anthropic error ${res.status}: ${body}`);
    }
  }
  const data = await parseJsonResponse(res, "Anthropic");
  const text = data.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("Anthropic response did not include message text.");
  return text;
}

export async function callGoogle({ apiKey, model, prompt, temperature }: ProviderCallParams): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature } }),
  });
  if (!res.ok) throw new Error(`Google AI error ${res.status}: ${await parseErrorBody(res)}`);
  const data = await parseJsonResponse(res, "Google AI");
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
  temperature,
}: ProviderCallParams & { baseUrl: string }): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature }),
  });
  if (!res.ok) throw new Error(`${baseUrl} error ${res.status}: ${await parseErrorBody(res)}`);
  const data = await parseJsonResponse(res, baseUrl);
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
