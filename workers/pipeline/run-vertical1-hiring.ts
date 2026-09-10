import { fileURLToPath } from "node:url";
import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { greenhouseConnector } from "../connectors/job-boards/greenhouse.js";
import { leverConnector } from "../connectors/job-boards/lever.js";
import { ashbyConnector } from "../connectors/job-boards/ashby.js";
import { cryptoJobsListConnector } from "../connectors/job-boards/cryptojobslist.js";
import { web3CareerConnector } from "../connectors/job-boards/web3career.js";
import { twitterHiringSignalsConnector } from "../connectors/twitter/hiring-signals.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical1HiringRules } from "../scoring/rules/vertical1-hiring.js";

const CONNECTORS: SourceConnector[] = [
  greenhouseConnector,
  leverConnector,
  ashbyConnector,
  cryptoJobsListConnector,
  web3CareerConnector, // requires WEB3_CAREER_API_TOKEN, skips itself if absent
  twitterHiringSignalsConnector, // requires TWITTERAPI_IO_KEY, skips itself if absent
];

const config: SearchConfig = { vertical: "hiring" };

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
    console.log("No signals found this run. Add company slugs to config/target-companies/*.json to widen coverage.");
  } else {
    const results = await dedupeAndUpsert(allSignals, vertical1HiringRules);
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
