import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { buildRawSignal, classifyServiceType, roleKeywordsFrom, titleMatchesKeywords } from "./shared.js";
import { parseLocation } from "../../pipeline/shared.js";
import { missingConfigMessage, readJsonConfig } from "../../config-files.js";
import { resolveTargetCompanies } from "../../target-companies.js";

const CONFIG_FILE = "config/target-companies/greenhouse.json";

/**
 * Database rows entered on the Integrations page first, falling back to the
 * JSON file. Read on demand rather than at module scope: this file is loaded
 * inside a serverless function too, where a missing config used to throw
 * during module evaluation and take the whole discovery route down with it.
 */
async function configuredBoardTokens(): Promise<string[]> {
  const fromDb = await resolveTargetCompanies("greenhouse");
  if (fromDb) return fromDb.map((c) => c.identifier);
  const loaded = readJsonConfig<{ boardTokens: string[] }>(CONFIG_FILE);
  if (!loaded) throw new Error(missingConfigMessage(CONFIG_FILE));
  return loaded.boardTokens ?? [];
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  content?: string;
  location?: { name?: string };
}

interface GreenhouseBoardResponse {
  jobs: GreenhouseJob[];
}

async function fetchBoard(boardToken: string): Promise<GreenhouseJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return []; // board token doesn't exist / no public board
    throw new Error(`Greenhouse API error for ${boardToken}: ${res.status}`);
  }
  const data = (await res.json()) as GreenhouseBoardResponse;
  return data.jobs ?? [];
}

export const greenhouseConnector: SourceConnector = {
  name: "greenhouse",
  vertical: ["hiring"],
  enabled: true,
  requiresApiKey: false,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const boardTokens: string[] =
      (config.boardTokens as string[] | undefined) ?? (await configuredBoardTokens());
    const keywords = roleKeywordsFrom(config);
    const signals: RawSignal[] = [];

    for (const token of boardTokens) {
      const jobs = await fetchBoard(token);
      for (const job of jobs) {
        if (!titleMatchesKeywords(job.title, keywords)) continue;

        const textContent = (job.content ?? "").replace(/<[^>]+>/g, " ");
        const classification = classifyServiceType(job.title);
        signals.push(
          buildRawSignal({
            sourceConnector: "greenhouse",
            vertical: "hiring",
            projectName: token,
            signalText: `${job.title}${job.location?.name ? ` (${job.location.name})` : ""}. ${textContent.slice(0, 500)}`.trim(),
            evidenceUrl: job.absolute_url,
            postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
            extraMeta: {
              ...parseLocation(job.location?.name),
              opportunityType: classification?.opportunityType,
              serviceType: classification?.serviceType,
            },
            raw: job,
          })
        );
      }
    }

    return signals;
  },
};
