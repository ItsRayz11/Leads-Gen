import Parser from "rss-parser";
import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { buildRawSignal, classifyServiceType, roleKeywordsFrom, titleMatchesKeywords } from "./shared.js";

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
      const classification = classifyServiceType(rolePart ?? title);

      signals.push(
        buildRawSignal({
          sourceConnector: "cryptojobslist",
          vertical: "hiring",
          projectName,
          signalText: `${rolePart ?? title}. ${(item.contentSnippet ?? "").slice(0, 500)}`.trim(),
          evidenceUrl: item.link,
          postedAt: item.isoDate ? new Date(item.isoDate) : undefined,
          extraMeta: {
            // cryptojobslist.com only lists crypto/web3 roles — a real
            // property of the source, not a guess about any individual listing.
            industry: "Web3 / Crypto",
            opportunityType: classification?.opportunityType,
            serviceType: classification?.serviceType,
          },
          raw: item,
        })
      );
    }

    return signals;
  },
};
