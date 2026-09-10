import { readFileSync } from "node:fs";
import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { buildRawSignal, roleKeywordsFrom, titleMatchesKeywords } from "./shared.js";
import { repoPath } from "../../repo-root.js";

const CONFIG_PATH = repoPath("config/target-companies/lever.json");
const companySlugsConfig: { companySlugs: string[] } = JSON.parse(
  readFileSync(CONFIG_PATH, "utf-8")
);

interface LeverPosting {
  id: string;
  text: string; // title
  hostedUrl: string;
  createdAt: number; // epoch ms
  categories?: { location?: string; commitment?: string };
  descriptionPlain?: string;
}

async function fetchPostings(companySlug: string): Promise<LeverPosting[]> {
  const url = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Lever API error for ${companySlug}: ${res.status}`);
  }
  return (await res.json()) as LeverPosting[];
}

export const leverConnector: SourceConnector = {
  name: "lever",
  vertical: ["hiring"],
  enabled: true,
  requiresApiKey: false,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const companySlugs: string[] =
      (config.companySlugs as string[] | undefined) ?? companySlugsConfig.companySlugs;
    const keywords = roleKeywordsFrom(config);
    const signals: RawSignal[] = [];

    for (const slug of companySlugs) {
      const postings = await fetchPostings(slug);
      for (const posting of postings) {
        if (!titleMatchesKeywords(posting.text, keywords)) continue;

        signals.push(
          buildRawSignal({
            sourceConnector: "lever",
            vertical: "hiring",
            projectName: slug,
            signalText: `${posting.text}${
              posting.categories?.location ? ` (${posting.categories.location})` : ""
            }. ${(posting.descriptionPlain ?? "").slice(0, 500)}`.trim(),
            evidenceUrl: posting.hostedUrl,
            postedAt: posting.createdAt ? new Date(posting.createdAt) : undefined,
            extraMeta: {
              employmentType:
                posting.categories?.commitment?.toLowerCase().includes("full")
                  ? "full_time"
                  : undefined,
            },
            raw: posting,
          })
        );
      }
    }

    return signals;
  },
};
