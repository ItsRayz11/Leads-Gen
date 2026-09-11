import type { Vertical } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";
import { isProviderEnabled, type GatedProvider } from "../provider-gate.js";
import { readJsonConfig } from "../config-files.js";

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

const BOARD_CONFIGS: Record<string, { file: string; field: string; example: string; label: string }> = {
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

function jobBoardStatus(connectorName: keyof typeof BOARD_CONFIGS): { configured: boolean; reason: string } {
  const board = BOARD_CONFIGS[connectorName];
  const loaded = readJsonConfig<Record<string, unknown>>(board.file);
  if (!loaded) return { configured: false, reason: `${board.file} is not available in this deployment` };
  const companies = loaded[board.field];
  if (!Array.isArray(companies) || companies.length === 0) {
    return { configured: false, reason: `no companies to check — add ${board.field} (${board.example}) to ${board.file}` };
  }
  return { configured: true, reason: `${companies.length} compan${companies.length === 1 ? "y" : "ies"} configured` };
}

async function keyedProviderStatus(
  envVar: string,
  secretName: GatedProvider
): Promise<{ hasKey: boolean; enabled: boolean }> {
  const hasKey = Boolean(process.env[envVar]) || Boolean(await getProviderSecret(secretName));
  const enabled = await isProviderEnabled(secretName);
  return { hasKey, enabled };
}

/**
 * One row per connector across all three verticals — the same reasoning
 * each `zeroResultNote()` computes after a zero-signal run, made callable
 * proactively so the Discovery page can show it before anyone clicks Run.
 */
export async function getAllProviderStatuses(): Promise<ProviderStatus[]> {
  const statuses: ProviderStatus[] = [];

  for (const name of Object.keys(BOARD_CONFIGS) as (keyof typeof BOARD_CONFIGS)[]) {
    const { configured, reason } = jobBoardStatus(name);
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

  const agencyConfig = readJsonConfig<{ agencies: unknown[] }>("config/target-companies/agencies.json");
  const agencyCount = agencyConfig?.agencies?.length ?? 0;
  statuses.push({
    connector: "agency-website-enrichment",
    label: "Website enrichment (seeded agencies)",
    vertical: "card_affiliate",
    configured: agencyCount > 0,
    reason:
      agencyCount > 0
        ? `${agencyCount} agenc${agencyCount === 1 ? "y" : "ies"} seeded`
        : "no agencies seeded in config/target-companies/agencies.json",
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

  return statuses;
}
