import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { buildRawSignal, classifyServiceType, roleKeywordsFrom, titleMatchesKeywords } from "./shared.js";
import { parseLocation } from "../../pipeline/shared.js";
import { missingConfigMessage, readJsonConfig } from "../../config-files.js";
import { resolveTargetCompanies } from "../../target-companies.js";

const CONFIG_FILE = "config/target-companies/lever.json";

/**
 * Database rows entered on the Integrations page first, falling back to the
 * JSON file. Read on demand rather than at module scope: this file is loaded
 * inside a serverless function too, where a missing config used to throw
 * during module evaluation and take the whole discovery route down with it.
 */
async function configuredCompanySlugs(): Promise<string[]> {
  const fromDb = await resolveTargetCompanies("lever");
  if (fromDb) return fromDb.map((c) => c.identifier);
  const loaded = readJsonConfig<{ companySlugs: string[] }>(CONFIG_FILE);
  if (!loaded) throw new Error(missingConfigMessage(CONFIG_FILE));
  return loaded.companySlugs ?? [];
}

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
      (config.companySlugs as string[] | undefined) ?? (await configuredCompanySlugs());
    const keywords = roleKeywordsFrom(config);
    const signals: RawSignal[] = [];

    for (const slug of companySlugs) {
      const postings = await fetchPostings(slug);
      for (const posting of postings) {
        if (!titleMatchesKeywords(posting.text, keywords)) continue;

        const classification = classifyServiceType(posting.text);
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
              ...parseLocation(posting.categories?.location),
              opportunityType: classification?.opportunityType,
              serviceType: classification?.serviceType,
            },
            raw: posting,
          })
        );
      }
    }

    return signals;
  },
};
