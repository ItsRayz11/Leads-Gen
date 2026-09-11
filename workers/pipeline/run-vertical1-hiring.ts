import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { greenhouseConnector } from "../connectors/job-boards/greenhouse.js";
import { leverConnector } from "../connectors/job-boards/lever.js";
import { ashbyConnector } from "../connectors/job-boards/ashby.js";
import { cryptoJobsListConnector } from "../connectors/job-boards/cryptojobslist.js";
import { web3CareerConnector } from "../connectors/job-boards/web3career.js";
import { twitterHiringSignalsConnector } from "../connectors/twitter/hiring-signals.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical1HiringRules } from "../scoring/rules/vertical1-hiring.js";
import { isRunAsScript, runStatus, type RunResult } from "./shared.js";
import { runConnectors, safeReporter, type ProgressReporter } from "./progress.js";
import { getAllProviderStatuses } from "./provider-status.js";

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
 * Why a connector found nothing, when the reason isn't "no matches this
 * run" — surfaced on the Discovery page instead of a silent zero. Backed by
 * `provider-status.ts`, the same source the Sources panel reads, so this
 * never drifts out of sync with what the UI tells the user beforehand.
 */
async function zeroResultNote(connectorName: string): Promise<string | undefined> {
  if (connectorName === "cryptojobslist") {
    return "the public feed returned no listings matching the target roles right now";
  }
  const status = (await getAllProviderStatuses()).find((s) => s.connector === connectorName);
  return status && !status.configured ? status.reason : undefined;
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
