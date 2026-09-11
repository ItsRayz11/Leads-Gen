import { readFileSync } from "node:fs";
import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { buildRawSignal, classifyServiceType, roleKeywordsFrom, titleMatchesKeywords } from "./shared.js";
import { parseLocation } from "../../pipeline/shared.js";
import { repoPath } from "../../repo-root.js";

const CONFIG_PATH = repoPath("config/target-companies/ashby.json");
const boardNamesConfig: { boardNames: string[] } = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  publishedAt?: string;
  location?: string;
  descriptionPlain?: string;
  employmentType?: string;
}

interface AshbyBoardResponse {
  jobs: AshbyJob[];
}

async function fetchBoard(boardName: string): Promise<AshbyJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${boardName}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Ashby API error for ${boardName}: ${res.status}`);
  }
  const data = (await res.json()) as AshbyBoardResponse;
  return data.jobs ?? [];
}

export const ashbyConnector: SourceConnector = {
  name: "ashby",
  vertical: ["hiring"],
  enabled: true,
  requiresApiKey: false,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const boardNames: string[] =
      (config.boardNames as string[] | undefined) ?? boardNamesConfig.boardNames;
    const keywords = roleKeywordsFrom(config);
    const signals: RawSignal[] = [];

    for (const boardName of boardNames) {
      const jobs = await fetchBoard(boardName);
      for (const job of jobs) {
        if (!titleMatchesKeywords(job.title, keywords)) continue;

        const classification = classifyServiceType(job.title);
        signals.push(
          buildRawSignal({
            sourceConnector: "ashby",
            vertical: "hiring",
            projectName: boardName,
            signalText: `${job.title}${job.location ? ` (${job.location})` : ""}. ${(
              job.descriptionPlain ?? ""
            ).slice(0, 500)}`.trim(),
            evidenceUrl: job.jobUrl,
            postedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
            extraMeta: {
              employmentType: job.employmentType?.toLowerCase().includes("full")
                ? "full_time"
                : undefined,
              ...parseLocation(job.location),
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
