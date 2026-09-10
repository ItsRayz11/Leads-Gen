import { fileURLToPath } from "node:url";
import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { websiteEnrichmentConnector } from "../connectors/agencies/website-enrichment.js";
import { twitterAgencySignalsConnector } from "../connectors/twitter/agency-signals.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical3CardAffiliateRules } from "../scoring/rules/vertical3-card-affiliate.js";

const CONNECTORS: SourceConnector[] = [
  websiteEnrichmentConnector,
  twitterAgencySignalsConnector, // requires TWITTERAPI_IO_KEY, skips itself if absent
];

const config: SearchConfig = { vertical: "card_affiliate" };

async function main() {
  const allSignals: RawSignal[] = [];

  for (const connector of CONNECTORS) {
    if (!connector.enabled) continue;
    try {
      const signals = await connector.fetch(config);
      console.log(`[${connector.name}] found ${signals.length} matching signals`);
      allSignals.push(...signals);
    } catch (err) {
      console.error(`[${connector.name}] failed:`, err);
    }
  }

  if (allSignals.length === 0) {
    console.log(
      "No signals found this run. Add agencies to config/target-companies/agencies.json to widen coverage."
    );
  } else {
    const results = await dedupeAndUpsert(allSignals, vertical3CardAffiliateRules);
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
