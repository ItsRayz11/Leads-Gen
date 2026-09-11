import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { greenhouseConnector } from "../connectors/job-boards/greenhouse.js";
import { leverConnector } from "../connectors/job-boards/lever.js";
import { ashbyConnector } from "../connectors/job-boards/ashby.js";
import { cryptoJobsListConnector } from "../connectors/job-boards/cryptojobslist.js";
import { web3CareerConnector } from "../connectors/job-boards/web3career.js";
import { twitterHiringSignalsConnector } from "../connectors/twitter/hiring-signals.js";
import { getProviderSecret } from "@leads/db/secrets.js";
import { isProviderEnabled } from "../provider-gate.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical1HiringRules } from "../scoring/rules/vertical1-hiring.js";
import { isRunAsScript, runStatus, type RunResult } from "./shared.js";
import { runConnectors, safeReporter, type ProgressReporter } from "./progress.js";
import { readJsonConfig } from "../config-files.js";

const CONNECTORS: SourceConnector[] = [
  greenhouseConnector,
  leverConnector,
  ashbyConnector,
  cryptoJobsListConnector,
  web3CareerConnector, // requires WEB3_CAREER_API_TOKEN, skips itself if absent
  twitterHiringSignalsConnector, // requires TWITTERAPI_IO_KEY, skips itself if absent
];

const config: SearchConfig = { vertical: "hiring" };

/**
 * The board-token config each job-board connector reads, and the field in it
 * that lists the companies to check. These APIs have no "search everything"
 * endpoint — they only return jobs for companies you name — so an empty list
 * means the connector had nothing to do, not that nobody is hiring.
 */
const BOARD_CONFIGS: Record<string, { file: string; field: string; example: string }> = {
  greenhouse: {
    file: "config/target-companies/greenhouse.json",
    field: "boardTokens",
    example: "the {token} in job-boards.greenhouse.io/{token}",
  },
  lever: {
    file: "config/target-companies/lever.json",
    field: "companySlugs",
    example: "the {slug} in jobs.lever.co/{slug}",
  },
  ashby: {
    file: "config/target-companies/ashby.json",
    field: "boardNames",
    example: "the {board} in jobs.ashbyhq.com/{board}",
  },
};

/** Why a connector found nothing, when the reason isn't "no matches this run" — surfaced on the Discovery page instead of a silent zero. */
async function zeroResultNote(connectorName: string): Promise<string | undefined> {
  const board = BOARD_CONFIGS[connectorName];
  if (board) {
    const loaded = readJsonConfig<Record<string, unknown>>(board.file);
    if (!loaded) return `${board.file} is not available in this deployment`;
    const companies = loaded[board.field];
    if (!Array.isArray(companies) || companies.length === 0) {
      return `no companies to check — add ${board.field} (${board.example}) to ${board.file}`;
    }
  }
  if (connectorName === "cryptojobslist") {
    return "the public feed returned no listings matching the target roles right now";
  }
  if (connectorName === "web3career" && !process.env.WEB3_CAREER_API_TOKEN && !(await getProviderSecret("web3_career"))) {
    return "no API token configured — add one on the Integrations page";
  }
  if (connectorName === "twitter-hiring-signals") {
    if (!process.env.TWITTERAPI_IO_KEY && !(await getProviderSecret("twitterapi_io"))) {
      return "no API key configured — add one on the Integrations page";
    }
    if (!(await isProviderEnabled("twitterapi_io"))) return "switched off on the Integrations page";
  }
  return undefined;
}

export async function runVertical1Hiring(onProgress?: ProgressReporter): Promise<RunResult> {
  const report = safeReporter(onProgress);

  report({ type: "stage", stage: "starting", message: `Starting hiring-signal discovery across ${CONNECTORS.length} sources` });
  report({ type: "stage", stage: "connectors", message: "Searching job boards for hiring signals" });

  const { signals: allSignals, connectorCounts } = await runConnectors<SourceConnector, RawSignal>(
    CONNECTORS,
    (connector) => connector.fetch(config),
    report,
    zeroResultNote
  );

  if (allSignals.length === 0) {
    console.log("No signals found this run. Add company slugs to config/target-companies/*.json to widen coverage.");
    report({ type: "stage", stage: "done", message: "No signals found this run" });
    return { signalsFound: 0, connectorCounts, leadsUpserted: [], status: runStatus(connectorCounts) };
  }

  report({ type: "stage", stage: "dedupe", message: `Grouping ${allSignals.length} signal(s) by company` });
  report({ type: "stage", stage: "scoring", message: "Upserting and scoring leads" });

  const results = await dedupeAndUpsert(allSignals, vertical1HiringRules, report);
  const leadsUpserted = results
    .sort((a, b) => b.score - a.score)
    .map((r) => ({ companyName: r.companyName, score: r.score }));
  console.log(`Upserted ${results.length} leads:`);
  for (const r of leadsUpserted) {
    console.log(`  [${r.score}] ${r.companyName}`);
  }
  report({ type: "stage", stage: "done", message: `${leadsUpserted.length} lead(s) upserted` });
  return { signalsFound: allSignals.length, connectorCounts, leadsUpserted, status: runStatus(connectorCounts) };
}

if (isRunAsScript(import.meta.url)) {
  runVertical1Hiring().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
