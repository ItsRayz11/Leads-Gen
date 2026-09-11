import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";
import { buildRawSignal, classifyServiceType, roleKeywordsFrom, titleMatchesKeywords } from "./shared.js";
import { parseLocation } from "../../pipeline/shared.js";
import { isProviderEnabled } from "../../provider-gate.js";

// Confirmed live endpoint (not officially documented in public docs, taken
// from the open-source web3-jobs MCP server's implementation). Free token:
// request one at https://web3.career/web3-jobs-api
const BASE_URL = "https://web3.career/api/v1";

interface Web3CareerJob {
  id: string;
  title: string;
  company: string;
  location?: string;
  url: string;
  date_epoch?: number;
  description?: string;
  remote?: boolean;
}

export const web3CareerConnector: SourceConnector = {
  name: "web3career",
  vertical: ["hiring"],
  enabled: true,
  requiresApiKey: true,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const token = process.env.WEB3_CAREER_API_TOKEN ?? (await getProviderSecret("web3_career"));
    if (!token) {
      console.warn("[web3career] no API token (env or Integrations page), skipping connector.");
      return [];
    }

    if (!(await isProviderEnabled("web3_career"))) return [];

    const keywords = roleKeywordsFrom(config);
    const params = new URLSearchParams({ token, limit: "100" });
    const res = await fetch(`${BASE_URL}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`web3.career API error: ${res.status}`);
    }

    const data = (await res.json()) as Web3CareerJob[] | { jobs?: Web3CareerJob[] };
    const jobs: Web3CareerJob[] = Array.isArray(data) ? data : data.jobs ?? [];

    return jobs
      .filter((job) => titleMatchesKeywords(job.title, keywords))
      .map((job) => {
        const classification = classifyServiceType(job.title);
        return buildRawSignal({
          sourceConnector: "web3career",
          vertical: "hiring",
          projectName: job.company,
          signalText: `${job.title}${job.location ? ` (${job.location})` : ""}. ${(
            job.description ?? ""
          ).slice(0, 500)}`.trim(),
          evidenceUrl: job.url,
          postedAt: job.date_epoch ? new Date(job.date_epoch * 1000) : undefined,
          extraMeta: {
            // web3.career only lists crypto/web3 companies — a real property
            // of the source, not a guess about any individual listing.
            industry: "Web3 / Crypto",
            ...(job.remote ? { region: "Global / Remote" } : parseLocation(job.location)),
            opportunityType: classification?.opportunityType,
            serviceType: classification?.serviceType,
          },
          raw: job,
        });
      });
  },
};
