import Parser from "rss-parser";
import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { buildRawSignal, roleKeywordsFrom, titleMatchesKeywords } from "./shared.js";

const FEED_URL = "https://api.cryptojobslist.com/jobs.rss";

const parser = new Parser();

export const cryptoJobsListConnector: SourceConnector = {
  name: "cryptojobslist",
  vertical: ["hiring"],
  enabled: true,
  requiresApiKey: false,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const keywords = roleKeywordsFrom(config);
    const feed = await parser.parseURL(FEED_URL);
    const signals: RawSignal[] = [];

    for (const item of feed.items) {
      const title = item.title ?? "";
      if (!titleMatchesKeywords(title, keywords)) continue;

      // CryptoJobsList titles are typically "Role at Company"
      const [rolePart, companyPart] = title.split(/\s+at\s+/i);
      const projectName = companyPart?.trim() || title;

      signals.push(
        buildRawSignal({
          sourceConnector: "cryptojobslist",
          vertical: "hiring",
          projectName,
          signalText: `${rolePart ?? title}. ${(item.contentSnippet ?? "").slice(0, 500)}`.trim(),
          evidenceUrl: item.link,
          postedAt: item.isoDate ? new Date(item.isoDate) : undefined,
          raw: item,
        })
      );
    }

    return signals;
  },
};
