import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { websiteEnrichmentConnector } from "../connectors/agencies/website-enrichment.js";
import { twitterAgencySignalsConnector } from "../connectors/twitter/agency-signals.js";
import { getProviderSecret } from "@leads/db/secrets.js";
import { isProviderEnabled } from "../provider-gate.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical3CardAffiliateRules } from "../scoring/rules/vertical3-card-affiliate.js";
import { isRunAsScript, runStatus, type RunResult } from "./shared.js";
import { runConnectors, safeReporter, type ProgressReporter } from "./progress.js";
import { readJsonConfig } from "../config-files.js";

const CONNECTORS: SourceConnector[] = [
  websiteEnrichmentConnector,
  twitterAgencySignalsConnector, // requires TWITTERAPI_IO_KEY, skips itself if absent
];

const config: SearchConfig = { vertical: "card_affiliate" };

/** Why a connector found nothing, when the reason isn't "no matches this run" — surfaced on the Discovery page instead of a silent zero. */
async function zeroResultNote(connectorName: string): Promise<string | undefined> {
  if (connectorName === "agency-website-enrichment") {
    const loaded = readJsonConfig<{ agencies: unknown[] }>("config/target-companies/agencies.json");
    if (!loaded) return "config/target-companies/agencies.json is not available in this deployment";
    if (loaded.agencies.length === 0) return "no agencies seeded in config/target-companies/agencies.json";
  }
  if (connectorName === "twitter-agency-signals") {
    if (!process.env.TWITTERAPI_IO_KEY && !(await getProviderSecret("twitterapi_io"))) {
      return "no API key configured — add one on the Integrations page";
    }
    if (!(await isProviderEnabled("twitterapi_io"))) return "switched off on the Integrations page";
  }
  return undefined;
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
