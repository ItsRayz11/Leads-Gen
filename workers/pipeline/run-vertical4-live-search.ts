import { DEFAULT_LIVE_SEARCH_PROVIDERS, type LiveSearchProvider, type RawSignal, type SourceConnector } from "@leads/core";
import { geminiWebSearchConnector } from "../connectors/live-search/gemini-web-search.js";
import { openaiWebSearchConnector } from "../connectors/live-search/openai-web-search.js";
import { anthropicWebSearchConnector } from "../connectors/live-search/anthropic-web-search.js";
import { loadSearchConfigs } from "./load-search-configs.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical4LiveSearchRules } from "../scoring/rules/vertical4-live-search.js";
import { isRunAsScript, runStatus, type ConnectorCount, type RunResult } from "./shared.js";
import { errorMessage, safeReporter, type ProgressReporter } from "./progress.js";
import { getLiveSearchProviderStatuses, type ProviderStatus } from "./provider-status.js";

const CONNECTOR_BY_PROVIDER: Record<LiveSearchProvider, SourceConnector> = {
  google: geminiWebSearchConnector,
  openai: openaiWebSearchConnector,
  anthropic: anthropicWebSearchConnector,
};

/** A readable name for one config's keyword set, used in progress labels. */
function configLabel(keywords: string[] | undefined): string {
  const joined = keywords?.join(", ");
  return joined && joined.length > 0 ? joined : "no keywords";
}

/**
 * Live-search equivalent of runVertical2General: loads whatever
 * search_configs rows exist for vertical=live_search (created via "Run
 * discovery pipeline" or "Add to discovery pipeline" on a saved search) and,
 * for each, runs a real web search through whichever provider(s) that
 * config chose (`live_search_providers` — see search-filter-editor.tsx),
 * defaulting to Gemini alone when none were picked. Running more than one
 * provider for the same config means more (differently-sourced) results,
 * not a replacement for the others — the dedupe step downstream merges
 * whatever they all found into one lead per company, and a company two
 * providers both found scores extra corroboration credit for it.
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

  const providerStatuses = await getLiveSearchProviderStatuses();
  const statusFor = (connectorName: string): ProviderStatus | undefined =>
    providerStatuses.find((s) => s.connector === connectorName);

  const providerCount = new Set(configs.flatMap((c) => c.liveSearchProviders ?? DEFAULT_LIVE_SEARCH_PROVIDERS)).size;
  report({
    type: "stage",
    stage: "connectors",
    message: `Running live web search (${providerCount} provider${providerCount === 1 ? "" : "s"}) across ${configs.length} search config(s)`,
  });

  for (const config of configs) {
    const providers = config.liveSearchProviders?.length ? config.liveSearchProviders : DEFAULT_LIVE_SEARCH_PROVIDERS;
    // Providers for the same config are independent network calls to
    // different services — run them concurrently so picking all three costs
    // roughly the slowest single call's time, not the sum of all three.
    // Configs themselves stay sequential, which is plenty of concurrency for
    // the handful of configs a real workspace has.
    const perProvider = await Promise.all(
      providers.map(async (provider): Promise<RawSignal[]> => {
        const connector = CONNECTOR_BY_PROVIDER[provider];
        const label = `${connector.name} · ${configLabel(config.keywords)}`;
        if (!connector.enabled) {
          report({ type: "connector:skipped", connector: label, reason: "disabled" });
          return [];
        }
        report({ type: "connector:start", connector: label });
        try {
          const signals = await connector.fetch(config);
          const status = statusFor(connector.name);
          const note = signals.length === 0 && status && !status.configured ? status.reason : undefined;
          connectorCounts.push({ connector: label, signalsFound: signals.length, note });
          report({ type: "connector:done", connector: label, signalsFound: signals.length, note });
          return signals;
        } catch (err) {
          const error = errorMessage(err);
          console.error(`[${connector.name}] failed for config "${config.keywords?.join(", ")}":`, err);
          connectorCounts.push({ connector: label, signalsFound: 0, error });
          report({ type: "connector:error", connector: label, error });
          return [];
        }
      })
    );
    for (const signals of perProvider) allSignals.push(...signals);
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
