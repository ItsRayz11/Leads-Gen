import type { RawSignal, SourceConnector } from "@leads/core";
import { hackerNewsConnector } from "../connectors/generic/hackernews.js";
import { loadSearchConfigs } from "./load-search-configs.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical2GeneralRules } from "../scoring/rules/vertical2-general.js";
import { isRunAsScript } from "./shared.js";

const CONNECTORS: SourceConnector[] = [hackerNewsConnector];

export async function runVertical2General() {
  const configs = await loadSearchConfigs("general");
  const allSignals: RawSignal[] = [];
  const connectorCounts: { connector: string; signalsFound: number }[] = [];

  for (const config of configs) {
    for (const connector of CONNECTORS) {
      if (!connector.enabled) continue;
      try {
        const signals = await connector.fetch(config);
        console.log(`[${connector.name}] "${config.keywords?.join(", ")}" -> ${signals.length} signals`);
        connectorCounts.push({ connector: connector.name, signalsFound: signals.length });
        allSignals.push(...signals);
      } catch (err) {
        console.error(`[${connector.name}] failed for config "${config.keywords?.join(", ")}":`, err);
      }
    }
  }

  if (allSignals.length === 0) {
    console.log(
      "No signals found this run. Add rows to the search_configs table (or edit config/search-configs/vertical2.json) to widen coverage."
    );
    return { signalsFound: 0, connectorCounts, leadsUpserted: [] as { companyName: string; score: number }[] };
  }

  const results = await dedupeAndUpsert(allSignals, vertical2GeneralRules);
  const leadsUpserted = results
    .sort((a, b) => b.score - a.score)
    .map((r) => ({ companyName: r.companyName, score: r.score }));
  console.log(`Upserted ${results.length} leads:`);
  for (const r of leadsUpserted) {
    console.log(`  [${r.score}] ${r.companyName}`);
  }
  return { signalsFound: allSignals.length, connectorCounts, leadsUpserted };
}

if (isRunAsScript(import.meta.url)) {
  runVertical2General().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
