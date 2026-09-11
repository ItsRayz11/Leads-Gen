import type { RawSignal, SourceConnector } from "@leads/core";
import { hackerNewsConnector } from "../connectors/generic/hackernews.js";
import { loadSearchConfigs } from "./load-search-configs.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical2GeneralRules } from "../scoring/rules/vertical2-general.js";
import { isRunAsScript, runStatus, type ConnectorCount, type RunResult } from "./shared.js";
import { errorMessage, safeReporter, type ProgressReporter } from "./progress.js";

const CONNECTORS: SourceConnector[] = [hackerNewsConnector];

/** A readable name for one config's keyword set, used in progress labels. */
function configLabel(keywords: string[] | undefined): string {
  const joined = keywords?.join(", ");
  return joined && joined.length > 0 ? joined : "no keywords";
}

export async function runVertical2General(onProgress?: ProgressReporter): Promise<RunResult> {
  const report = safeReporter(onProgress);

  report({ type: "stage", stage: "starting", message: "Loading search configs for general B2B/B2C" });
  const configs = await loadSearchConfigs("general");
  const allSignals: RawSignal[] = [];
  const connectorCounts: ConnectorCount[] = [];

  if (configs.length === 0) {
    const note =
      "No enabled search_configs rows for vertical=general — add one on the Discovery page or in config/search-configs/vertical2.json.";
    report({ type: "stage", stage: "done", message: note });
    return { signalsFound: 0, connectorCounts, leadsUpserted: [], note, status: "completed_with_warnings" };
  }

  report({
    type: "stage",
    stage: "connectors",
    message: `Searching ${CONNECTORS.length} source(s) across ${configs.length} search config(s)`,
  });

  for (const config of configs) {
    for (const connector of CONNECTORS) {
      // One label per (config, connector) pair: the same connector runs once
      // per config, so the bare connector name would collide in the UI list.
      const label = `${connector.name} · ${configLabel(config.keywords)}`;
      if (!connector.enabled) {
        report({ type: "connector:skipped", connector: label, reason: "disabled" });
        continue;
      }
      report({ type: "connector:start", connector: label });
      try {
        const signals = await connector.fetch(config);
        console.log(`[${connector.name}] "${config.keywords?.join(", ")}" -> ${signals.length} signals`);
        connectorCounts.push({ connector: label, signalsFound: signals.length });
        report({ type: "connector:done", connector: label, signalsFound: signals.length });
        allSignals.push(...signals);
      } catch (err) {
        const error = errorMessage(err);
        console.error(`[${connector.name}] failed for config "${config.keywords?.join(", ")}":`, err);
        connectorCounts.push({ connector: label, signalsFound: 0, error });
        report({ type: "connector:error", connector: label, error });
      }
    }
  }

  if (allSignals.length === 0) {
    console.log(
      "No signals found this run. Add rows to the search_configs table (or edit config/search-configs/vertical2.json) to widen coverage."
    );
    const note = "No matches this run for the configured keywords/industries.";
    report({ type: "stage", stage: "done", message: note });
    return { signalsFound: 0, connectorCounts, leadsUpserted: [], note, status: runStatus(connectorCounts) };
  }

  report({ type: "stage", stage: "dedupe", message: `Grouping ${allSignals.length} signal(s) by company` });
  report({ type: "stage", stage: "scoring", message: "Upserting and scoring leads" });

  const results = await dedupeAndUpsert(allSignals, vertical2GeneralRules, report);
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
  runVertical2General().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
