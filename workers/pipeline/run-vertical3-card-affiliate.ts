import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { websiteEnrichmentConnector } from "../connectors/agencies/website-enrichment.js";
import { twitterAgencySignalsConnector } from "../connectors/twitter/agency-signals.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical3CardAffiliateRules } from "../scoring/rules/vertical3-card-affiliate.js";
import { isRunAsScript, runStatus, type RunResult } from "./shared.js";
import { runConnectors, safeReporter, type ProgressReporter } from "./progress.js";
import { getAllProviderStatuses } from "./provider-status.js";

const CONNECTORS: SourceConnector[] = [
  websiteEnrichmentConnector,
  twitterAgencySignalsConnector, // requires TWITTERAPI_IO_KEY, skips itself if absent
];

const config: SearchConfig = { vertical: "card_affiliate" };

/**
 * Why a connector found nothing — see the identical comment in
 * run-vertical1-hiring.ts; both defer to the shared `provider-status.ts`.
 */
async function zeroResultNote(connectorName: string): Promise<string | undefined> {
  const status = (await getAllProviderStatuses()).find((s) => s.connector === connectorName);
  return status && !status.configured ? status.reason : undefined;
}

export async function runVertical3CardAffiliate(onProgress?: ProgressReporter): Promise<RunResult> {
  const report = safeReporter(onProgress);

  report({ type: "stage", stage: "starting", message: `Starting card-affiliate discovery across ${CONNECTORS.length} sources` });
  report({ type: "stage", stage: "connectors", message: "Visiting seeded agency websites for ad-spend signals" });

  const { signals: allSignals, connectorCounts } = await runConnectors<SourceConnector, RawSignal>(
    CONNECTORS,
    (connector) => connector.fetch(config),
    report,
    zeroResultNote
  );

  if (allSignals.length === 0) {
    console.log(
      "No signals found this run. Add agencies to config/target-companies/agencies.json to widen coverage."
    );
    report({ type: "stage", stage: "done", message: "No signals found this run" });
    return { signalsFound: 0, connectorCounts, leadsUpserted: [], status: runStatus(connectorCounts) };
  }

  report({ type: "stage", stage: "dedupe", message: `Grouping ${allSignals.length} signal(s) by agency` });
  report({ type: "stage", stage: "scoring", message: "Upserting and scoring leads" });

  const results = await dedupeAndUpsert(allSignals, vertical3CardAffiliateRules, report);
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
  runVertical3CardAffiliate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
