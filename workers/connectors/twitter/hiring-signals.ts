import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";
import { buildRawSignal, classifyServiceType, roleKeywordsFrom } from "../job-boards/shared.js";
import { isProviderEnabled } from "../../provider-gate.js";

// twitterapi.io (third-party, paid) advanced search — NOT free. Requires
// TWITTERAPI_IO_KEY. See https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search
const BASE_URL = "https://api.twitterapi.io/twitter/tweet/advanced_search";

interface TwitterApiIoTweet {
  id: string;
  url: string;
  text: string;
  createdAt: string;
  author: { userName: string; name: string };
}

interface TwitterApiIoResponse {
  tweets: TwitterApiIoTweet[];
  has_next_page: boolean;
  next_cursor: string;
}

const HIRING_PHRASES = ['"we\'re hiring"', '"we are hiring"', '"join our team"', '"now hiring"'];

function buildQuery(keywords: string[]): string {
  const roleClause = `(${keywords.map((k) => `"${k}"`).join(" OR ")})`;
  const hiringClause = `(${HIRING_PHRASES.join(" OR ")})`;
  const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return `${roleClause} ${hiringClause} since:${sinceDate}`;
}

async function searchTweets(query: string, apiKey: string): Promise<TwitterApiIoTweet[]> {
  const tweets: TwitterApiIoTweet[] = [];
  let cursor = "";
  let hasNext = true;
  let pages = 0;

  while (hasNext && pages < 3) {
    const params = new URLSearchParams({ query, queryType: "Latest", cursor });
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      headers: { "X-API-Key": apiKey },
    });
    if (!res.ok) {
      throw new Error(`twitterapi.io error: ${res.status}`);
    }
    const data = (await res.json()) as TwitterApiIoResponse;
    tweets.push(...(data.tweets ?? []));
    hasNext = data.has_next_page;
    cursor = data.next_cursor;
    pages++;
  }

  return tweets;
}

export const twitterHiringSignalsConnector: SourceConnector = {
  name: "twitter-hiring-signals",
  vertical: ["hiring"],
  enabled: true,
  requiresApiKey: true,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const apiKey = process.env.TWITTERAPI_IO_KEY ?? (await getProviderSecret("twitterapi_io"));
    if (!apiKey) {
      console.warn("[twitter-hiring-signals] no API key (env or Integrations page), skipping connector.");
      return [];
    }

    if (!(await isProviderEnabled("twitterapi_io"))) return [];

    const keywords = roleKeywordsFrom(config);
    const query = buildQuery(keywords);
    const tweets = await searchTweets(query, apiKey);

    return tweets.map((tweet) => {
      const classification = classifyServiceType(tweet.text);
      return buildRawSignal({
        sourceConnector: "twitter-hiring-signals",
        vertical: "hiring",
        // Company name isn't structured data on a tweet — this needs a human
        // (or a follow-up enrichment step) to confirm which project the
        // author's account represents before it's treated as a real lead.
        projectName: tweet.author.name || tweet.author.userName,
        signalText: tweet.text,
        evidenceUrl: tweet.url,
        postedAt: tweet.createdAt ? new Date(tweet.createdAt) : undefined,
        extraMeta: {
          needsManualConfirmation: true,
          authorHandle: tweet.author.userName,
          opportunityType: classification?.opportunityType,
          serviceType: classification?.serviceType,
        },
        raw: tweet,
      });
    });
  },
};
