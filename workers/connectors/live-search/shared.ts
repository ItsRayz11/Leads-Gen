import { getProviderSecret } from "@leads/db/secrets.js";
import { LIVE_SEARCH_PROVIDER_LABELS, type LiveSearchProvider } from "@leads/core";
import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";

export const MAX_RESULTS = 8;

/**
 * The one place a live-search provider's connector name / API key source is
 * declared. gemini-web-search.ts/openai-web-search.ts/anthropic-web-search.ts
 * each only pass a `provider` key into createLiveSearchConnector rather than
 * repeating their own envVar/secretName/connector-name — and
 * provider-status.ts reads this same table (via getLiveSearchProviderStatuses
 * in provider-status.ts) so the Integrations status line and this connector
 * can never check a different env var/secret for the same provider.
 */
export const LIVE_SEARCH_PROVIDER_INFO: Record<
  LiveSearchProvider,
  { connectorName: string; envVar: string; secretName: string }
> = {
  google: { connectorName: "gemini-web-search", envVar: "GOOGLE_AI_API_KEY", secretName: "google" },
  openai: { connectorName: "openai-web-search", envVar: "OPENAI_API_KEY", secretName: "openai" },
  anthropic: { connectorName: "anthropic-web-search", envVar: "ANTHROPIC_API_KEY", secretName: "anthropic" },
};

/** Env var first (fast path, matches apps/web/lib/ai/client.ts), else the encrypted Integrations-page key. Shared so all three provider connectors resolve keys the same way. */
export async function resolveApiKey(envVar: string, providerName: string): Promise<string | null> {
  if (process.env[envVar]) return process.env[envVar]!;
  return getProviderSecret(providerName);
}

async function readErrorBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return text.slice(0, 300);
}

/**
 * A provider can answer with a 2xx status but a non-JSON body (a proxy
 * outage page, a CDN challenge page); calling `res.json()` on that throws an
 * opaque `SyntaxError` that's meaningless in a log. Checks content-type first
 * so a bad response fails with a message that says what actually happened —
 * mirrors apps/web/lib/ai/providers.ts's parseJsonResponse, duplicated here
 * rather than imported since workers doesn't depend on the web app.
 */
export async function fetchJson(url: string, init: RequestInit, label: string): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${label} error ${res.status}: ${await readErrorBody(res)}`);

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `${label} returned a non-JSON response (status ${res.status}, content-type "${contentType || "unknown"}"): ${await readErrorBody(res)}`
    );
  }
  return res.json();
}

/**
 * One candidate a provider reports finding via a live web search. Kept
 * intentionally small — the model is asked to extract only what it can
 * actually back with a real citation, not to guess at anything else.
 */
export interface LiveSearchResult {
  companyName: string;
  website?: string;
  signalText: string;
  sourceUrl: string;
  industry?: string;
  country?: string;
  relevance: "high" | "medium" | "low";
  hasExplicitSignal: boolean;
  contactName?: string;
  contactTitle?: string;
}

/** The same instructions for every provider — only how the call is made and the response is unwrapped differs. */
export function buildLiveSearchPrompt(config: SearchConfig): string {
  const lines: string[] = [
    "You are helping a B2B/B2C lead-generation search. Use your live web search capability right now to",
    "find real, currently-active companies or organizations matching this request — do not answer from",
    "memory alone.",
    "",
    "Business context: the requester runs an agency selling social/community/crypto marketing services",
    "(community management, KOL/influencer marketing, Discord/Telegram management, growth/performance",
    "marketing) and Bitget Wallet Card affiliate referrals.",
    "",
    "Request:",
  ];
  const requestLineCount = lines.length;
  if (config.keywords?.length) lines.push(`- Keywords: ${config.keywords.join(", ")}`);
  if (config.industries?.length) lines.push(`- Industries: ${config.industries.join(", ")}`);
  if (config.geography?.length) lines.push(`- Geography: ${config.geography.join(", ")}`);
  if (config.excludeKeywords?.length) lines.push(`- Exclude: ${config.excludeKeywords.join(", ")}`);
  if (lines.length === requestLineCount) {
    lines.push("- (no specific keywords given — use the business context above alone)");
  }

  lines.push(
    "",
    `Find up to ${MAX_RESULTS} distinct companies/organizations. For each, you must have found a real,`,
    "specific web page about it during this search — never invent a company, a URL, or a person.",
    "Skip anything you can't back with an actual page you found.",
    "",
    "Respond with ONLY a JSON array (no markdown fences, no prose). Each item:",
    "{",
    '  "companyName": string,',
    '  "website": string | null,        // the company\'s own domain, if you found one',
    '  "signalText": string,            // one sentence: what you found and why it is relevant',
    '  "sourceUrl": string,             // the exact page URL you found this on',
    '  "industry": string | null,',
    '  "country": string | null,',
    '  "relevance": "high" | "medium" | "low",  // how well this matches the request',
    '  "hasExplicitSignal": boolean,    // true only if the page itself describes an active need',
    '                                   // (hiring, RFP, budget, a launch) rather than just general fit',
    '  "contactName": string | null,    // only if a named person is publicly attached to this on the page',
    '  "contactTitle": string | null',
    "}"
  );

  return lines.join("\n");
}

/** The end index of the `]` balancing an already-known `[` at `start`, tracking depth and ignoring brackets inside string literals — or -1 if the brackets never close. */
function findMatchingBracketEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Finds the JSON array of *objects* in a string, trying every top-level
 * `[...]` in turn rather than just the first one. A web-search-augmented
 * model can tack on an inline citation marker like "[1]" before its real
 * answer despite being told not to — locking onto only the first bracket
 * (a plain `indexOf`/`lastIndexOf` pair, or a depth-tracker that still only
 * starts from the first `[`) would return that citation instead of the
 * actual array. Requiring at least one object element rules out a bare
 * citation array (`[1]`, `[1,2]`) without requiring the model to get the
 * *first* bracket right.
 */
function extractJsonArray(text: string): unknown[] | null {
  let from = 0;
  while (true) {
    const start = text.indexOf("[", from);
    if (start === -1) return null;

    const end = findMatchingBracketEnd(text, start);
    if (end !== -1) {
      try {
        const candidate = JSON.parse(text.slice(start, end + 1));
        if (Array.isArray(candidate) && candidate.some((item) => item !== null && typeof item === "object")) {
          return candidate;
        }
      } catch {
        // Not valid JSON from this bracket — keep scanning for the next one.
      }
    }
    from = start + 1;
  }
}

/** Pulls the JSON array out of a response, tolerating markdown fences and a sentence of preamble. */
export function parseLiveSearchResults(text: string): LiveSearchResult[] {
  const withoutFences = text.replace(/```(?:json)?/gi, "").trim();

  // The prompt instructs "ONLY a JSON array, no prose" — when the model
  // actually follows that, the whole trimmed string parses directly with no
  // bracket-scanning needed at all. Only fall back to the scanner for the
  // cases where it didn't (markdown fences already stripped above, but a
  // sentence of preamble or an inline citation marker can still remain).
  let parsed: unknown;
  try {
    const whole = JSON.parse(withoutFences);
    parsed = Array.isArray(whole) ? whole : null;
  } catch {
    parsed = null;
  }
  parsed ??= extractJsonArray(withoutFences);
  if (!Array.isArray(parsed)) return [];

  const out: LiveSearchResult[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const companyName = typeof r.companyName === "string" ? r.companyName.trim() : "";
    const signalText = typeof r.signalText === "string" ? r.signalText.trim() : "";
    const sourceUrl = typeof r.sourceUrl === "string" ? r.sourceUrl.trim() : "";
    // A result with no real citation is exactly the "invented" case the
    // prompt tells the model to skip — enforced here too rather than trusted.
    if (!companyName || !signalText || !/^https?:\/\//i.test(sourceUrl)) continue;

    out.push({
      companyName,
      website: typeof r.website === "string" && r.website.trim() ? r.website.trim() : undefined,
      signalText,
      sourceUrl,
      industry: typeof r.industry === "string" && r.industry.trim() ? r.industry.trim() : undefined,
      country: typeof r.country === "string" && r.country.trim() ? r.country.trim() : undefined,
      relevance: r.relevance === "high" || r.relevance === "medium" || r.relevance === "low" ? r.relevance : "low",
      hasExplicitSignal: Boolean(r.hasExplicitSignal),
      contactName: typeof r.contactName === "string" && r.contactName.trim() ? r.contactName.trim() : undefined,
      contactTitle: typeof r.contactTitle === "string" && r.contactTitle.trim() ? r.contactTitle.trim() : undefined,
    });
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

/**
 * Everything one provider-specific live-search connector needs to supply:
 * which provider it is (its connector name/API key source come from
 * LIVE_SEARCH_PROVIDER_INFO, not repeated per connector), how to build its
 * (very different-shaped) request, and how to pull the plain response text
 * back out. The prompt, fetch/error handling, result parsing and signal
 * mapping are identical across providers and live in this one factory
 * instead of being copy-pasted into gemini-web-search.ts/
 * openai-web-search.ts/anthropic-web-search.ts three times.
 */
export interface LiveSearchProviderAdapter {
  provider: LiveSearchProvider;
  /** Builds the provider-specific HTTP request for a given API key and prompt. */
  buildRequest(apiKey: string, prompt: string): { url: string; init: RequestInit };
  /** Pulls the model's plain-text answer out of that provider's response shape. */
  extractText(data: any): string;
}

export function createLiveSearchConnector(adapter: LiveSearchProviderAdapter): SourceConnector {
  const info = LIVE_SEARCH_PROVIDER_INFO[adapter.provider];
  const errorLabel = `${LIVE_SEARCH_PROVIDER_LABELS[adapter.provider]} web search`;
  return {
    name: info.connectorName,
    vertical: ["live_search"],
    enabled: true,
    requiresApiKey: true,
    async fetch(config: SearchConfig): Promise<RawSignal[]> {
      const apiKey = await resolveApiKey(info.envVar, info.secretName);
      if (!apiKey) return [];

      const prompt = buildLiveSearchPrompt(config);
      const { url, init } = adapter.buildRequest(apiKey, prompt);
      const data = await fetchJson(url, init, errorLabel);
      const text = adapter.extractText(data);
      const results = parseLiveSearchResults(text);
      return liveSearchResultsToSignals(results, info.connectorName, config);
    },
  };
}

/** Turns parsed results into the signals dedupeAndUpsert expects — identical mapping regardless of which provider found them. */
export function liveSearchResultsToSignals(
  results: LiveSearchResult[],
  sourceConnector: string,
  config: SearchConfig
): RawSignal[] {
  const discoveredAt = new Date();
  return results.map((r) => ({
    sourceConnector,
    vertical: "live_search",
    projectName: r.companyName,
    website: r.website,
    signalText: r.signalText,
    evidenceUrl: r.sourceUrl,
    contacts:
      r.contactName && r.contactTitle
        ? [{ name: r.contactName, title: r.contactTitle, contactMethod: "public_web_page", contactValue: r.sourceUrl }]
        : undefined,
    discoveredAt,
    meta: {
      relevance: r.relevance,
      hasExplicitSignal: r.hasExplicitSignal,
      industry: r.industry,
      country: r.country,
      opportunityType: "live_search",
      serviceType: config.keywords?.slice(0, 3).join(", "),
      // Every other connector sets this on its own meta for consistency, even
      // though it isn't load-bearing for scoring: dedupe-and-upsert.ts already
      // falls the persisted signal_date back to discoveredAt when a signal
      // carries no postedAt, and that's what rescoreLead's freshness read
      // (newestPostedAt in scoring/rules/shared.ts) actually rebuilds from —
      // not this in-memory field, which never survives past this connector.
      postedAt: discoveredAt,
    },
    raw: r,
  }));
}
