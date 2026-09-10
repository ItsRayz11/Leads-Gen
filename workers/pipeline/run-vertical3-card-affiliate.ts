import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { websiteEnrichmentConnector } from "../connectors/agencies/website-enrichment.js";
import { twitterAgencySignalsConnector } from "../connectors/twitter/agency-signals.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical3CardAffiliateRules } from "../scoring/rules/vertical3-card-affiliate.js";
import { isRunAsScript } from "./shared.js";

const CONNECTORS: SourceConnector[] = [
  websiteEnrichmentConnector,
  twitterAgencySignalsConnector, // requires TWITTERAPI_IO_KEY, skips itself if absent
];

const config: SearchConfig = { vertical: "card_affiliate" };

export async function runVertical3CardAffiliate() {
  const allSignals: RawSignal[] = [];
  const connectorCounts: { connector: string; signalsFound: number }[] = [];

  for (const connector of CONNECTORS) {
    if (!connector.enabled) continue;
    try {
      const signals = await connector.fetch(config);
      console.log(`[${connector.name}] found ${signals.length} matching signals`);
      connectorCounts.push({ connector: connector.name, signalsFound: signals.length });
      allSignals.push(...signals);
    } catch (err) {
      console.error(`[${connector.name}] failed:`, err);
    }
  }

  if (allSignals.length === 0) {
    console.log(
      "No signals found this run. Add agencies to config/target-companies/agencies.json to widen coverage."
    );
    return { signalsFound: 0, connectorCounts, leadsUpserted: [] as { companyName: string; score: number }[] };
  }

  const results = await dedupeAndUpsert(allSignals, vertical3CardAffiliateRules);
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
  runVertical3CardAffiliate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
