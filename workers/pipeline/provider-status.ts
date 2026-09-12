import { LIVE_SEARCH_PROVIDERS, LIVE_SEARCH_PROVIDER_LABELS, type Vertical } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";
import { listTargetCompanies } from "@leads/db/target-companies.js";
import { isProviderEnabled, type GatedProvider } from "../provider-gate.js";
import { readJsonConfig } from "../config-files.js";
import { LIVE_SEARCH_PROVIDER_INFO } from "../connectors/live-search/shared.js";

/**
 * Whether a connector can actually act on one kind of filter, and why not
 * when it can't. This is what lets the UI show "not supported by this
 * source" instead of a filter that's silently ignored — see the Discovery
 * page's Sources panel, and the per-connector reasoning this mirrors
 * (originally only written as code comments in each connector).
 */
export interface ProviderCapability {
  supported: boolean;
  note?: string;
}

export interface ProviderCapabilities {
  industry: ProviderCapability;
  geography: ProviderCapability;
  jobTitle: ProviderCapability;
  companySize: ProviderCapability;
}

export interface ProviderStatus {
  connector: string;
  label: string;
  vertical: Vertical;
  configured: boolean;
  /** Why it's ready, or why it isn't — always set, never a bare boolean with no explanation. */
  reason: string;
  capabilities: ProviderCapabilities;
}

function cap(supported: boolean, note?: string): ProviderCapability {
  return { supported, note };
}

const JOB_BOARD_CAPABILITIES: ProviderCapabilities = {
  industry: cap(false, "job boards carry no industry taxonomy"),
  geography: cap(true),
  jobTitle: cap(true),
  companySize: cap(false),
};

const BOARD_CONFIGS: Record<"greenhouse" | "lever" | "ashby", { file: string; field: string; example: string; label: string }> = {
  greenhouse: {
    file: "config/target-companies/greenhouse.json",
    field: "boardTokens",
    example: "the {token} in job-boards.greenhouse.io/{token}",
    label: "Greenhouse",
  },
  lever: {
    file: "config/target-companies/lever.json",
    field: "companySlugs",
    example: "the {slug} in jobs.lever.co/{slug}",
    label: "Lever",
  },
  ashby: {
    file: "config/target-companies/ashby.json",
    field: "boardNames",
    example: "the {board} in jobs.ashbyhq.com/{board}",
    label: "Ashby",
  },
};

async function jobBoardStatus(connectorName: keyof typeof BOARD_CONFIGS): Promise<{ configured: boolean; reason: string }> {
  const board = BOARD_CONFIGS[connectorName];

  const dbRows = await listTargetCompanies(connectorName);
  const dbEnabled = dbRows.filter((r) => r.enabled);
  if (dbEnabled.length > 0) {
    return { configured: true, reason: `${dbEnabled.length} compan${dbEnabled.length === 1 ? "y" : "ies"} configured` };
  }

  const loaded = readJsonConfig<Record<string, unknown>>(board.file);
  const companies = loaded?.[board.field];
  if (Array.isArray(companies) && companies.length > 0) {
    return { configured: true, reason: `${companies.length} compan${companies.length === 1 ? "y" : "ies"} configured (${board.file})` };
  }
  return {
    configured: false,
    reason: `no companies to check — add them (${board.example}) on the Integrations page`,
  };
}

async function keyedProviderStatus(
  envVar: string,
  secretName: GatedProvider
): Promise<{ hasKey: boolean; enabled: boolean }> {
  const hasKey = Boolean(process.env[envVar]) || Boolean(await getProviderSecret(secretName));
  const enabled = await isProviderEnabled(secretName);
  return { hasKey, enabled };
}

const LIVE_SEARCH_CAPABILITIES: ProviderCapabilities = {
  industry: cap(true, "asked for directly, not a structured filter"),
  geography: cap(true, "asked for directly, not a structured filter"),
  jobTitle: cap(true, "asked for directly, not a structured filter"),
  companySize: cap(false, "live search results carry no headcount data"),
};

/**
 * Status for just the 3 live-search connectors — split out from
 * getAllProviderStatuses so run-vertical4-live-search.ts doesn't have to pay
 * for the unrelated job-board/Twitter/agency checks (each its own DB query or
 * file read) on every live-search run just to read 3 rows out of the result.
 * Reads the same LIVE_SEARCH_PROVIDER_INFO the connectors themselves use for
 * their env var/secret name, and the same LIVE_SEARCH_PROVIDER_LABELS the
 * provider picker UI renders, so this can't drift from either.
 */
export async function getLiveSearchProviderStatuses(): Promise<ProviderStatus[]> {
  return Promise.all(
    LIVE_SEARCH_PROVIDERS.map(async (provider) => {
      const { connectorName, envVar, secretName } = LIVE_SEARCH_PROVIDER_INFO[provider];
      const label = LIVE_SEARCH_PROVIDER_LABELS[provider];
      const hasKey = Boolean(process.env[envVar]) || Boolean(await getProviderSecret(secretName));
      return {
        connector: connectorName,
        label: `Live web search — ${label}`,
        vertical: "live_search" as const,
        configured: hasKey,
        reason: hasKey ? `ready — searches live via ${label}` : "no API key configured — add one on the Integrations page",
        capabilities: LIVE_SEARCH_CAPABILITIES,
      };
    })
  );
}

/**
 * One row per connector across all four verticals — the same reasoning
 * each `zeroResultNote()` computes after a zero-signal run, made callable
 * proactively so the Discovery page can show it before anyone clicks Run.
 */
export async function getAllProviderStatuses(): Promise<ProviderStatus[]> {
  const statuses: ProviderStatus[] = [];

  for (const name of Object.keys(BOARD_CONFIGS) as (keyof typeof BOARD_CONFIGS)[]) {
    const { configured, reason } = await jobBoardStatus(name);
    statuses.push({
      connector: name,
      label: BOARD_CONFIGS[name].label,
      vertical: "hiring",
      configured,
      reason,
      capabilities: JOB_BOARD_CAPABILITIES,
    });
  }

  statuses.push({
    connector: "cryptojobslist",
    label: "CryptoJobsList",
    vertical: "hiring",
    configured: true,
    reason: "public feed, no configuration required",
    capabilities: JOB_BOARD_CAPABILITIES,
  });

  const web3Career = await keyedProviderStatus("WEB3_CAREER_API_TOKEN", "web3_career");
  statuses.push({
    connector: "web3career",
    label: "Web3.career",
    vertical: "hiring",
    configured: web3Career.hasKey && web3Career.enabled,
    reason: !web3Career.hasKey
      ? "no API token configured — add one on the Integrations page"
      : !web3Career.enabled
        ? "switched off on the Integrations page"
        : "ready",
    capabilities: JOB_BOARD_CAPABILITIES,
  });

  const twitter = await keyedProviderStatus("TWITTERAPI_IO_KEY", "twitterapi_io");
  const twitterReason = !twitter.hasKey
    ? "no API key configured — add one on the Integrations page"
    : !twitter.enabled
      ? "switched off on the Integrations page"
      : "ready";
  const twitterCapabilities: ProviderCapabilities = {
    industry: cap(false),
    geography: cap(false, "tweets carry no reliable location data"),
    jobTitle: cap(true, "keyword match against tweet text, not a structured field"),
    companySize: cap(false),
  };

  statuses.push({
    connector: "twitter-hiring-signals",
    label: "Twitter hiring signals",
    vertical: "hiring",
    configured: twitter.hasKey && twitter.enabled,
    reason: twitterReason,
    capabilities: twitterCapabilities,
  });

  statuses.push({
    connector: "hackernews",
    label: "Hacker News",
    vertical: "general",
    configured: true,
    reason: "ready — no API key required",
    capabilities: {
      industry: cap(false, "used as an extra keyword search term, not a real filter — HN has no industry taxonomy"),
      geography: cap(false, "HN posts carry no location; a country filter would just match posts that mention the place"),
      jobTitle: cap(false),
      companySize: cap(false),
    },
  });

  const dbAgencies = (await listTargetCompanies("agency")).filter((r) => r.enabled);
  const agencyConfig = readJsonConfig<{ agencies: unknown[] }>("config/target-companies/agencies.json");
  const fileAgencyCount = agencyConfig?.agencies?.length ?? 0;
  const agencyCount = dbAgencies.length > 0 ? dbAgencies.length : fileAgencyCount;
  statuses.push({
    connector: "agency-website-enrichment",
    label: "Website enrichment (seeded agencies)",
    vertical: "card_affiliate",
    configured: agencyCount > 0,
    reason:
      dbAgencies.length > 0
        ? `${dbAgencies.length} agenc${dbAgencies.length === 1 ? "y" : "ies"} seeded`
        : fileAgencyCount > 0
          ? `${fileAgencyCount} agenc${fileAgencyCount === 1 ? "y" : "ies"} seeded (config/target-companies/agencies.json)`
          : "no agencies seeded — add them on the Integrations page",
    capabilities: {
      industry: cap(true, "seeded list is pre-classified by vertical"),
      geography: cap(false),
      jobTitle: cap(false),
      companySize: cap(false),
    },
  });

  statuses.push({
    connector: "twitter-agency-signals",
    label: "Twitter agency signals",
    vertical: "card_affiliate",
    configured: twitter.hasKey && twitter.enabled,
    reason: twitterReason,
    capabilities: twitterCapabilities,
  });

  statuses.push(...(await getLiveSearchProviderStatuses()));

  return statuses;
}
