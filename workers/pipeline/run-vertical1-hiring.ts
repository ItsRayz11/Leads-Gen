import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { greenhouseConnector } from "../connectors/job-boards/greenhouse.js";
import { leverConnector } from "../connectors/job-boards/lever.js";
import { ashbyConnector } from "../connectors/job-boards/ashby.js";
import { cryptoJobsListConnector } from "../connectors/job-boards/cryptojobslist.js";
import { web3CareerConnector } from "../connectors/job-boards/web3career.js";
import { twitterHiringSignalsConnector } from "../connectors/twitter/hiring-signals.js";
import { getProviderSecret } from "@leads/db/secrets.js";
import { isProviderEnabled } from "../provider-gate.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical1HiringRules } from "../scoring/rules/vertical1-hiring.js";
import { isRunAsScript, type ConnectorCount } from "./shared.js";

const CONNECTORS: SourceConnector[] = [
  greenhouseConnector,
  leverConnector,
  ashbyConnector,
  cryptoJobsListConnector,
  web3CareerConnector, // requires WEB3_CAREER_API_TOKEN, skips itself if absent
  twitterHiringSignalsConnector, // requires TWITTERAPI_IO_KEY, skips itself if absent
];

const config: SearchConfig = { vertical: "hiring" };

/** Why a connector found nothing, when the reason isn't "no matches this run" — surfaced on the Discovery page instead of a silent zero. */
async function zeroResultNote(connectorName: string): Promise<string | undefined> {
  if (connectorName === "web3career" && !process.env.WEB3_CAREER_API_TOKEN && !(await getProviderSecret("web3_career"))) {
    return "no API token configured — add one on the Integrations page";
  }
  if (connectorName === "twitter-hiring-signals") {
    if (!process.env.TWITTERAPI_IO_KEY && !(await getProviderSecret("twitterapi_io"))) {
      return "no API key configured — add one on the Integrations page";
    }
    if (!(await isProviderEnabled("twitterapi_io"))) return "switched off on the Integrations page";
  }
  return undefined;
}

export async function runVertical1Hiring() {
  const allSignals: RawSignal[] = [];
  const connectorCounts: ConnectorCount[] = [];

  for (const connector of CONNECTORS) {
    if (!connector.enabled) continue;
    try {
      const signals = await connector.fetch(config);
      console.log(`[${connector.name}] found ${signals.length} matching signals`);
      const note = signals.length === 0 ? await zeroResultNote(connector.name) : undefined;
      connectorCounts.push({ connector: connector.name, signalsFound: signals.length, note });
      allSignals.push(...signals);
    } catch (err) {
      console.error(`[${connector.name}] failed:`, err);
    }
  }

  if (allSignals.length === 0) {
    console.log("No signals found this run. Add company slugs to config/target-companies/*.json to widen coverage.");
    return { signalsFound: 0, connectorCounts, leadsUpserted: [] as { companyName: string; score: number }[] };
  }

  const results = await dedupeAndUpsert(allSignals, vertical1HiringRules);
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
  runVertical1Hiring().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
