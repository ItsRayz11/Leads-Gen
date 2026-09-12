import { getProviderSecret } from "@leads/db/secrets.js";
import type { RawSignal, SearchConfig } from "@leads/core";

export const MAX_RESULTS = 8;

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

/**
 * Finds the first top-level, balanced `[...]` in a string — unlike a plain
 * `indexOf("[")`/`lastIndexOf("]")` pair, this isn't fooled by a stray bracket
 * appearing before or after the real array (a web-search-augmented model
 * quoting a source with an inline "[1]" citation, for instance), because it
 * tracks bracket depth and ignores brackets inside string literals.
 */
function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start === -1) return null;

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
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // unbalanced — no complete array to parse
}

/** Pulls the JSON array out of a response, tolerating markdown fences and a sentence of preamble. */
export function parseLiveSearchResults(text: string): LiveSearchResult[] {
  const withoutFences = text.replace(/```(?:json)?/gi, "").trim();
  const jsonArrayText = extractJsonArray(withoutFences);
  if (!jsonArrayText) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonArrayText);
  } catch {
    return [];
  }
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
    },
    raw: r,
  }));
}
