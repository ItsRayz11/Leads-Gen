import type { RawSignal, SearchConfig } from "@leads/core";

export const MAX_RESULTS = 8;

/**
 * Grounded/web-search calls cost more than a plain generation call, and nothing
 * else bounds how often these connectors can be triggered — a saved search
 * re-run twice in quick succession (a double-click, a page reload mid-run)
 * would otherwise fire the same paid search twice for the same result.
 * Per-process only (a cold serverless instance resets it), so this is a
 * courtesy against accidental repeats, not a hard budget cap — there is no
 * spend-tracking infrastructure in this app to build a real one against (see
 * provider-status.ts / provider-gate.ts).
 */
const COOLDOWN_MS = 30_000;

/** One independent cooldown map per connector, so Gemini/OpenAI/Anthropic running for the same config don't gate each other. */
export function createCooldownGuard() {
  const lastRunAt = new Map<string, number>();
  return {
    /** True (and does NOT mark) when this exact config is still cooling down. */
    isCoolingDown(config: SearchConfig): boolean {
      const key = cooldownKey(config);
      const last = lastRunAt.get(key);
      return Boolean(last && Date.now() - last < COOLDOWN_MS);
    },
    mark(config: SearchConfig): void {
      lastRunAt.set(cooldownKey(config), Date.now());
    },
  };
}

function cooldownKey(config: SearchConfig): string {
  return JSON.stringify({
    keywords: config.keywords ?? [],
    industries: config.industries ?? [],
    geography: config.geography ?? [],
    excludeKeywords: config.excludeKeywords ?? [],
  });
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

/** Pulls the JSON array out of a response, tolerating markdown fences and a sentence of preamble. */
export function parseLiveSearchResults(text: string): LiveSearchResult[] {
  const withoutFences = text.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFences.indexOf("[");
  const end = withoutFences.lastIndexOf("]");
  if (start === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFences.slice(start, end + 1));
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
