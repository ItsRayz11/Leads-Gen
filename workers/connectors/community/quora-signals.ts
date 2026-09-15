import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";
import { isProviderEnabled } from "../../provider-gate.js";
import { buildRawSignal } from "../job-boards/shared.js";

const BASE_URL = "https://api.firecrawl.dev/v1/search";
const MAX_KEYWORDS = 5;

interface FirecrawlSearchResult {
  title?: string;
  url: string;
  description?: string;
  markdown?: string;
}

interface FirecrawlSearchResponse {
  success: boolean;
  data?: FirecrawlSearchResult[];
}

async function searchQuora(keyword: string, apiKey: string): Promise<FirecrawlSearchResult[]> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `site:quora.com ${keyword}`,
      limit: 10,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl search API error: ${res.status}`);
  const data = (await res.json()) as FirecrawlSearchResponse;
  return data.data ?? [];
}

/**
 * Best-effort only: Quora doesn't expose upvote/answer counts through
 * search-result metadata, and its pages are JS-rendered and often blocked to
 * scrapers, so the scraped markdown may not contain these numbers at all.
 * When it doesn't, both default to 0 rather than guessing — that's a
 * correctly "no evidence of engagement" score, not a wrong one, from the
 * `high-engagement`/`active-discussion` rules in vertical2-general.ts that
 * these numbers feed (see the projectName-level meta keys those rules key
 * off of already, reused here instead of adding Quora-specific ones).
 */
function extractEngagement(markdown: string | undefined): { engagementPoints: number; numComments: number } {
  if (!markdown) return { engagementPoints: 0, numComments: 0 };
  const upvotes = markdown.match(/([\d,]+)\s*(?:upvotes?|votes?)/i);
  const answers = markdown.match(/([\d,]+)\s*answers?/i);
  return {
    engagementPoints: upvotes ? parseInt(upvotes[1].replace(/,/g, ""), 10) : 0,
    numComments: answers ? parseInt(answers[1].replace(/,/g, ""), 10) : 0,
  };
}

function keywordsFrom(config: SearchConfig): string[] {
  const keywords = config.keywords ?? [];
  return keywords.slice(0, MAX_KEYWORDS);
}

/**
 * People publicly asking about (or discussing) topics matching the search
 * config's keywords on Quora — a community/intent signal alongside Hacker
 * News, not a company-formation signal, so `projectName` is the asker's
 * question title rather than a company name (matches how HN treats a
 * non-launch post: the title carries the signal, not an entity).
 */
export const quoraSignalsConnector: SourceConnector = {
  name: "quora-signals",
  vertical: ["general"],
  enabled: true,
  requiresApiKey: true,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const apiKey = process.env.FIRECRAWL_API_KEY ?? (await getProviderSecret("firecrawl"));
    if (!apiKey) {
      console.warn("[quora-signals] no API key (env or Integrations page), skipping connector.");
      return [];
    }
    if (!(await isProviderEnabled("firecrawl"))) return [];

    const keywords = keywordsFrom(config);
    if (keywords.length === 0) {
      console.warn("[quora-signals] no keywords configured, skipping — nothing to search for.");
      return [];
    }

    const signals: RawSignal[] = [];
    const seenUrls = new Set<string>();

    for (const keyword of keywords) {
      const results = await searchQuora(keyword, apiKey);
      for (const result of results) {
        if (!result.url || seenUrls.has(result.url)) continue;
        seenUrls.add(result.url);

        const { engagementPoints, numComments } = extractEngagement(result.markdown);

        signals.push(
          buildRawSignal({
            sourceConnector: "quora-signals",
            vertical: "general",
            projectName: result.title ?? keyword,
            signalText: result.description ?? result.title ?? keyword,
            evidenceUrl: result.url,
            extraMeta: {
              platform: "quora",
              engagementPoints,
              numComments,
              matchedKeyword: keyword,
              // A Quora question's author isn't necessarily whoever ends up
              // qualifying as the lead — same caveat as the Twitter signal
              // connectors — so this needs a human glance, not auto-outreach.
              needsManualConfirmation: true,
            },
            raw: result,
          })
        );
      }
    }

    return signals;
  },
};
