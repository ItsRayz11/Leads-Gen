import { readFileSync } from "node:fs";
import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { websiteEnrichmentConnector } from "../connectors/agencies/website-enrichment.js";
import { twitterAgencySignalsConnector } from "../connectors/twitter/agency-signals.js";
import { getProviderSecret } from "@leads/db/secrets.js";
import { isProviderEnabled } from "../provider-gate.js";
import { dedupeAndUpsert } from "./dedupe-and-upsert.js";
import { vertical3CardAffiliateRules } from "../scoring/rules/vertical3-card-affiliate.js";
import { isRunAsScript, type ConnectorCount } from "./shared.js";
import { repoPath } from "../repo-root.js";

const CONNECTORS: SourceConnector[] = [
  websiteEnrichmentConnector,
  twitterAgencySignalsConnector, // requires TWITTERAPI_IO_KEY, skips itself if absent
];

const config: SearchConfig = { vertical: "card_affiliate" };

/** Why a connector found nothing, when the reason isn't "no matches this run" — surfaced on the Discovery page instead of a silent zero. */
async function zeroResultNote(connectorName: string): Promise<string | undefined> {
  if (connectorName === "agency-website-enrichment") {
    const { agencies } = JSON.parse(
      readFileSync(repoPath("config/target-companies/agencies.json"), "utf-8")
    ) as { agencies: unknown[] };
    if (agencies.length === 0) return "no agencies seeded in config/target-companies/agencies.json";
  }
  if (connectorName === "twitter-agency-signals") {
    if (!process.env.TWITTERAPI_IO_KEY && !(await getProviderSecret("twitterapi_io"))) {
      return "no API key configured — add one on the Integrations page";
    }
    if (!(await isProviderEnabled("twitterapi_io"))) return "switched off on the Integrations page";
  }
  return undefined;
}

export async function runVertical3CardAffiliate() {
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
