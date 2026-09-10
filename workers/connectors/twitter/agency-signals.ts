import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { buildRawSignal } from "../job-boards/shared.js";

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

const AGENCY_SELF_DESCRIPTION_PHRASES = [
  '"media buying agency"',
  '"performance marketing agency"',
  '"meta ads agency"',
  '"paid ads agency"',
  '"we manage $"',
];

function buildQuery(): string {
  const clause = `(${AGENCY_SELF_DESCRIPTION_PHRASES.join(" OR ")})`;
  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return `${clause} since:${sinceDate}`;
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
    if (!res.ok) throw new Error(`twitterapi.io error: ${res.status}`);
    const data = (await res.json()) as TwitterApiIoResponse;
    tweets.push(...(data.tweets ?? []));
    hasNext = data.has_next_page;
    cursor = data.next_cursor;
    pages++;
  }

  return tweets;
}

export const twitterAgencySignalsConnector: SourceConnector = {
  name: "twitter-agency-signals",
  vertical: ["card_affiliate"],
  enabled: true,
  requiresApiKey: true,
  async fetch(_config: SearchConfig): Promise<RawSignal[]> {
    const apiKey = process.env.TWITTERAPI_IO_KEY;
    if (!apiKey) {
      console.warn("[twitter-agency-signals] TWITTERAPI_IO_KEY not set, skipping connector.");
      return [];
    }

    const tweets = await searchTweets(buildQuery(), apiKey);

    return tweets.map((tweet) =>
      buildRawSignal({
        sourceConnector: "twitter-agency-signals",
        vertical: "card_affiliate",
        // Same caveat as the hiring-signal Twitter connector: a tweet's
        // author account isn't guaranteed to be the agency itself, so this
        // needs a human glance before treating it as a confirmed lead.
        projectName: tweet.author.name || tweet.author.userName,
        signalText: tweet.text,
        evidenceUrl: tweet.url,
        postedAt: tweet.createdAt ? new Date(tweet.createdAt) : undefined,
        extraMeta: { needsManualConfirmation: true, authorHandle: tweet.author.userName },
        raw: tweet,
      })
    );
  },
};
