import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";

const BASE_URL = "https://hn.algolia.com/api/v1/search";
const LOOKBACK_DAYS = 30;

interface HnHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string;
  created_at: string;
  points: number | null;
  num_comments: number | null;
}

interface HnSearchResponse {
  hits: HnHit[];
}

async function searchHn(query: string): Promise<HnHit[]> {
  const sinceEpoch = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 60 * 60;
  const params = new URLSearchParams({
    query,
    tags: "story",
    numericFilters: `created_at_i>${sinceEpoch}`,
    hitsPerPage: "50",
  });
  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`HN Algolia API error: ${res.status}`);
  const data = (await res.json()) as HnSearchResponse;
  return data.hits;
}

/**
 * "Show HN: ProjectName – description" / "Launch HN: ProjectName (YC Sxx) – ..."
 * are the only HN title conventions with an extractable project name. Only a
 * dash/pipe with surrounding whitespace is treated as the name/description
 * separator — a bare hyphen inside a compound word ("load-bearing",
 * "on-device", "Open-Source") is not, or titles like "Show HN: I trained a
 * 125M model to autocomplete piano on-device" get truncated mid-word. If no
 * such separator is found, the whole (prefix-stripped) title is kept rather
 * than guessing.
 */
function extractProjectName(title: string): string {
  const withoutPrefix = title.replace(/^(?:show|launch)\s+hn:\s*/i, "");
  const [namePart] = withoutPrefix.split(/\s[–—|]\s|\s-\s/);
  return (namePart || withoutPrefix).trim();
}

export const hackerNewsConnector: SourceConnector = {
  name: "hackernews",
  vertical: ["general"],
  enabled: true,
  requiresApiKey: false,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const keywords = config.keywords ?? [];
    const excludeKeywords = config.excludeKeywords ?? [];
    const signals: RawSignal[] = [];
    const seenObjectIds = new Set<string>();

    for (const keyword of keywords) {
      const hits = await searchHn(keyword);
      for (const hit of hits) {
        if (!hit.title || seenObjectIds.has(hit.objectID)) continue;
        const lowerTitle = hit.title.toLowerCase();
        if (excludeKeywords.some((ex) => lowerTitle.includes(ex.toLowerCase()))) continue;
        seenObjectIds.add(hit.objectID);

        signals.push({
          sourceConnector: "hackernews",
          vertical: "general",
          projectName: extractProjectName(hit.title),
          signalText: hit.title,
          evidenceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          discoveredAt: new Date(),
          meta: {
            postedAt: hit.created_at ? new Date(hit.created_at) : undefined,
            engagementPoints: hit.points ?? 0,
            numComments: hit.num_comments ?? 0,
            isLaunchPost: /^(show|launch)\s+hn/i.test(hit.title),
            matchedKeyword: keyword,
            externalUrl: hit.url ?? undefined,
          },
          raw: hit,
        });
      }
    }

    return signals;
  },
};
