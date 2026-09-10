import { fileURLToPath } from "node:url";
import type { RawSignal, SourceConnector } from "@leads/core";
import { hackerNewsConnector } from "../connectors/generic/hackernews.js";
import { loadSearchConfigs } from "./load-search-configs.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical2GeneralRules } from "../scoring/rules/vertical2-general.js";

const CONNECTORS: SourceConnector[] = [hackerNewsConnector];

async function main() {
  const configs = await loadSearchConfigs("general");
  const allSignals: RawSignal[] = [];

  for (const config of configs) {
    for (const connector of CONNECTORS) {
      if (!connector.enabled) continue;
      try {
        const signals = await connector.fetch(config);
        console.log(`[${connector.name}] "${config.keywords?.join(", ")}" -> ${signals.length} signals`);
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
  } else {
    const results = await dedupeAndUpsert(allSignals, vertical2GeneralRules);
    console.log(`Upserted ${results.length} leads:`);
    for (const r of results.sort((a, b) => b.score - a.score)) {
      console.log(`  [${r.score}] ${r.companyName}`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
