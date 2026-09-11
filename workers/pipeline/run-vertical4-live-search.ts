import type { RawSignal, SourceConnector } from "@leads/core";
import { geminiWebSearchConnector } from "../connectors/live-search/gemini-web-search.js";
import { loadSearchConfigs } from "./load-search-configs.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical4LiveSearchRules } from "../scoring/rules/vertical4-live-search.js";
import { isRunAsScript, runStatus, type ConnectorCount, type RunResult } from "./shared.js";
import { errorMessage, safeReporter, type ProgressReporter } from "./progress.js";
import { getAllProviderStatuses } from "./provider-status.js";

const CONNECTORS: SourceConnector[] = [geminiWebSearchConnector];

/** A readable name for one config's keyword set, used in progress labels. */
function configLabel(keywords: string[] | undefined): string {
  const joined = keywords?.join(", ");
  return joined && joined.length > 0 ? joined : "no keywords";
}

/**
 * Live-search equivalent of runVertical2General: loads whatever
 * search_configs rows exist for vertical=live_search (created via "Run
 * discovery pipeline" or "Add to discovery pipeline" on a saved search) and
 * runs a real, grounded Gemini web search per config, instead of reading a
 * fixed set of connectors — that's the whole point of this vertical.
 */
export async function runVertical4LiveSearch(onProgress?: ProgressReporter): Promise<RunResult> {
  const report = safeReporter(onProgress);

  report({ type: "stage", stage: "starting", message: "Loading search configs for live web search" });
  const configs = await loadSearchConfigs("live_search");
  const allSignals: RawSignal[] = [];
  const connectorCounts: ConnectorCount[] = [];

  if (configs.length === 0) {
    const note =
      "No enabled search_configs rows for vertical=live_search — save/run a search from the Discovery page first.";
    report({ type: "stage", stage: "done", message: note });
    return { signalsFound: 0, connectorCounts, leadsUpserted: [], note, status: "completed_with_warnings" };
  }

  const googleStatus = (await getAllProviderStatuses()).find((s) => s.connector === "gemini-web-search");

  report({
    type: "stage",
    stage: "connectors",
    message: `Running a live grounded search across ${configs.length} search config(s)`,
  });

  for (const config of configs) {
    for (const connector of CONNECTORS) {
      const label = `${connector.name} · ${configLabel(config.keywords)}`;
      if (!connector.enabled) {
        report({ type: "connector:skipped", connector: label, reason: "disabled" });
        continue;
      }
      report({ type: "connector:start", connector: label });
      try {
        const signals = await connector.fetch(config);
        const note = signals.length === 0 && googleStatus && !googleStatus.configured ? googleStatus.reason : undefined;
        connectorCounts.push({ connector: label, signalsFound: signals.length, note });
        report({ type: "connector:done", connector: label, signalsFound: signals.length, note });
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
    const note = "No matches this run for the configured keywords/industries.";
    report({ type: "stage", stage: "done", message: note });
    return { signalsFound: 0, connectorCounts, leadsUpserted: [], note, status: runStatus(connectorCounts) };
  }

  report({ type: "stage", stage: "dedupe", message: `Grouping ${allSignals.length} signal(s) by company` });
  report({ type: "stage", stage: "scoring", message: "Upserting and scoring leads" });

  const results = await dedupeAndUpsert(allSignals, vertical4LiveSearchRules, report);
  const leadsUpserted = results
    .sort((a, b) => b.score - a.score)
    .map((r) => ({ companyName: r.companyName, score: r.score }));
  report({ type: "stage", stage: "done", message: `${leadsUpserted.length} lead(s) upserted` });
  return { signalsFound: allSignals.length, connectorCounts, leadsUpserted, status: runStatus(connectorCounts) };
}

if (isRunAsScript(import.meta.url)) {
  runVertical4LiveSearch().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
