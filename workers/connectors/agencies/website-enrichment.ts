import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { extractSiteSignals, stripHtml } from "./shared.js";
import { missingConfigMessage, readJsonConfig } from "../../config-files.js";
import { resolveTargetCompanies } from "../../target-companies.js";

/**
 * Buckets a self-reported headcount into the same bands the search filters
 * offer (COMPANY_SIZES in apps/web/lib/ai/search-filters.ts) so a "company
 * size" filter has real values on `companies.company_size` to match against.
 */
function bucketCompanySize(teamSize: number | undefined): string | undefined {
  if (teamSize === undefined) return undefined;
  if (teamSize <= 10) return "1-10";
  if (teamSize <= 50) return "11-50";
  if (teamSize <= 200) return "51-200";
  if (teamSize <= 500) return "201-500";
  if (teamSize <= 1000) return "501-1000";
  if (teamSize <= 5000) return "1001-5000";
  if (teamSize <= 10000) return "5001-10000";
  return "10001+";
}

const CONFIG_FILE = "config/target-companies/agencies.json";

interface AgencySeed {
  name: string;
  website: string;
  twitterHandle?: string;
}

/**
 * Database rows entered on the Integrations page first, falling back to the
 * JSON file. Read on demand — see config-files.ts for why this can't happen
 * at module scope.
 */
async function seededAgencies(): Promise<AgencySeed[]> {
  const fromDb = await resolveTargetCompanies("agency");
  if (fromDb) {
    return fromDb.map((c) => ({
      name: c.label ?? c.identifier,
      website: c.identifier,
      twitterHandle: typeof c.extra?.twitterHandle === "string" ? c.extra.twitterHandle : undefined,
    }));
  }
  const loaded = readJsonConfig<{ agencies: AgencySeed[] }>(CONFIG_FILE);
  if (!loaded) throw new Error(missingConfigMessage(CONFIG_FILE));
  return loaded.agencies ?? [];
}

const CANDIDATE_PATHS = ["", "/about", "/case-studies", "/work", "/clients"];

async function fetchPageText(baseUrl: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(new URL(path, baseUrl).toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; personal-lead-research/1.0)" },
    });
    if (!res.ok) return null;
    return stripHtml(await res.text());
  } catch {
    return null; // page doesn't exist at this path, or the fetch failed — not fatal
  }
}

/**
 * Visits an agency's own public pages (a single, low-volume fetch per page —
 * not crawling a third-party directory) and looks for self-reported scale
 * signals: disclosed ad-spend figures, number of channels managed, prior
 * crypto/Web3 client work, and team size.
 */
export const websiteEnrichmentConnector: SourceConnector = {
  name: "agency-website-enrichment",
  vertical: ["card_affiliate"],
  enabled: true,
  requiresApiKey: false,
  async fetch(_config: SearchConfig): Promise<RawSignal[]> {
    const agencies: AgencySeed[] =
      (_config.agencies as AgencySeed[] | undefined) ?? (await seededAgencies());
    const signals: RawSignal[] = [];

    for (const agency of agencies) {
      const texts: string[] = [];
      for (const path of CANDIDATE_PATHS) {
        const text = await fetchPageText(agency.website, path);
        if (text) texts.push(text);
      }
      if (texts.length === 0) continue;

      const combinedText = texts.join(" ").slice(0, 20_000);
      const siteSignals = extractSiteSignals(combinedText);

      signals.push({
        sourceConnector: "agency-website-enrichment",
        vertical: "card_affiliate",
        projectName: agency.name,
        website: agency.website,
        signalText:
          siteSignals.matchedSnippet ??
          `${agency.name} manages ${siteSignals.channelsCount} known ad channel type(s)${
            siteSignals.teamSizeEstimate ? `, team size ~${siteSignals.teamSizeEstimate}` : ""
          }.`,
        evidenceUrl: agency.website,
        discoveredAt: new Date(),
        meta: {
          ...siteSignals,
          industry: siteSignals.hasCryptoClientHistory ? "Web3 / Crypto" : "Digital Marketing",
          companySize: bucketCompanySize(siteSignals.teamSizeEstimate),
          opportunityType: "card_affiliate",
          serviceType: "Bitget Card Affiliate",
        },
        raw: { agency, combinedTextLength: combinedText.length },
      });
    }

    return signals;
  },
};
