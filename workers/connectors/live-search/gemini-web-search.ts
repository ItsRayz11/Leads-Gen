import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";

const ENDPOINT_MODEL = "gemini-3.6-flash";
const MAX_RESULTS = 8;

/**
 * Grounded search calls cost more than a plain generation call, and this is
 * the only connector in the app with no fixed source list to bound how often
 * it can be triggered — a saved search re-run twice in quick succession (a
 * double-click, a page reload mid-run) would otherwise fire the same paid
 * search twice for the same result. Per-process only (a cold serverless
 * instance resets it), so this is a courtesy against accidental repeats, not
 * a hard budget cap — there is no spend-tracking infrastructure in this app
 * to build a real one against (see provider-status.ts / provider-gate.ts).
 */
const COOLDOWN_MS = 30_000;
const lastRunAt = new Map<string, number>();

function cooldownKey(config: SearchConfig): string {
  return JSON.stringify({
    keywords: config.keywords ?? [],
    industries: config.industries ?? [],
    geography: config.geography ?? [],
    excludeKeywords: config.excludeKeywords ?? [],
  });
}

/**
 * One candidate the model reports finding via a live Google search. Kept
 * intentionally small — the model is asked to extract only what it can
 * actually back with a real citation, not to guess at anything else.
 */
interface LiveSearchResult {
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

/** Env var first (fast path, matches apps/web/lib/ai/client.ts), else the encrypted Integrations-page key. */
async function resolveGoogleApiKey(): Promise<string | null> {
  if (process.env.GOOGLE_AI_API_KEY) return process.env.GOOGLE_AI_API_KEY;
  return getProviderSecret("google");
}

function buildPrompt(config: SearchConfig): string {
  const lines: string[] = [
    "You are helping a B2B/B2C lead-generation search. Use your live Google Search capability right now",
    "to find real, currently-active companies or organizations matching this request — do not answer from",
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
function parseResults(text: string): LiveSearchResult[] {
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

/**
 * Runs one live, grounded Google search via the Gemini API and turns whatever
 * it finds into signals — the only connector in this app that goes out to
 * the open internet for whatever the user just asked, rather than reading a
 * fixed set of job boards/sites. See run-vertical4-live-search.ts for how its
 * results reach the same dedupe/scoring/upsert pipeline as every other
 * vertical.
 *
 * Requires a Google AI (Gemini) API key — the same one search interpretation
 * already uses (env `GOOGLE_AI_API_KEY` or the Integrations page). Grounding
 * is a Gemini-specific feature, so this bypasses the multi-provider
 * ai_provider_settings routing and always calls Google directly.
 */
export const geminiWebSearchConnector: SourceConnector = {
  name: "gemini-web-search",
  vertical: ["live_search"],
  enabled: true,
  requiresApiKey: true,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const apiKey = await resolveGoogleApiKey();
    if (!apiKey) return [];

    const key = cooldownKey(config);
    const last = lastRunAt.get(key);
    if (last && Date.now() - last < COOLDOWN_MS) {
      console.warn(`[gemini-web-search] skipped — same search ran ${Date.now() - last}ms ago (cooldown ${COOLDOWN_MS}ms)`);
      return [];
    }
    lastRunAt.set(key, Date.now());

    const prompt = buildPrompt(config);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${ENDPOINT_MODEL}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini web search error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const results = parseResults(text);

    const discoveredAt = new Date();
    return results.map((r) => ({
      sourceConnector: "gemini-web-search",
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
  },
};
