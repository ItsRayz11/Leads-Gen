import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { buildRawSignal, roleKeywordsFrom, titleMatchesKeywords } from "./shared.js";

const CONFIG_PATH = fileURLToPath(
  new URL("../../../config/target-companies/greenhouse.json", import.meta.url)
);
const boardTokensConfig: { boardTokens: string[] } = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

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
      (config.boardTokens as string[] | undefined) ?? boardTokensConfig.boardTokens;
    const keywords = roleKeywordsFrom(config);
    const signals: RawSignal[] = [];

    for (const token of boardTokens) {
      const jobs = await fetchBoard(token);
      for (const job of jobs) {
        if (!titleMatchesKeywords(job.title, keywords)) continue;

        const textContent = (job.content ?? "").replace(/<[^>]+>/g, " ");
        signals.push(
          buildRawSignal({
            sourceConnector: "greenhouse",
            vertical: "hiring",
            projectName: token,
            signalText: `${job.title}${job.location?.name ? ` (${job.location.name})` : ""}. ${textContent.slice(0, 500)}`.trim(),
            evidenceUrl: job.absolute_url,
            postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
            raw: job,
          })
        );
      }
    }

    return signals;
  },
};
