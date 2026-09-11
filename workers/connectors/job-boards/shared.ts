import type { RawSignal, SearchConfig, Vertical } from "@leads/core";

export const DEFAULT_ROLE_KEYWORDS = [
  "social media",
  "community manager",
  "community lead",
  "marketing manager",
  "marketing lead",
  "content manager",
  "content specialist",
  "kol",
  "affiliate",
  "growth marketing",
];

export function titleMatchesKeywords(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

export interface ServiceClassification {
  opportunityType: string;
  serviceType: string;
}

/**
 * Maps a role/signal title to the `leads.opportunity_type` /
 * `leads.service_type` vocabulary the search filters actually query against
 * (see SERVICE_TYPE_SUGGESTIONS in apps/web/lib/ai/search-filters.ts).
 * Ordered most-specific first since a title like "KOL & Community Manager"
 * should classify as KOL marketing, not fall through to the community rule.
 */
const SERVICE_TYPE_RULES: [RegExp, ServiceClassification][] = [
  [/\bkol\b|\binfluencer\b/i, { opportunityType: "kol_marketing", serviceType: "KOL Marketing" }],
  [/\baffiliate\b/i, { opportunityType: "affiliate", serviceType: "Bitget Card Affiliate" }],
  [/\bdiscord\b/i, { opportunityType: "community_mgmt", serviceType: "Discord Management" }],
  [/\btelegram\b/i, { opportunityType: "community_mgmt", serviceType: "Telegram Management" }],
  [/\bcommunity\b/i, { opportunityType: "community_mgmt", serviceType: "Community Management" }],
  [/\bsocial media\b/i, { opportunityType: "community_mgmt", serviceType: "Social Media Management" }],
  [/\bcontent\b/i, { opportunityType: "community_mgmt", serviceType: "Content Marketing" }],
  [/\bgrowth\b/i, { opportunityType: "growth_marketing", serviceType: "Growth Marketing" }],
  [/\bmarketing\b/i, { opportunityType: "growth_marketing", serviceType: "Digital Marketing" }],
];

export function classifyServiceType(title: string): ServiceClassification | null {
  for (const [re, classification] of SERVICE_TYPE_RULES) {
    if (re.test(title)) return classification;
  }
  return null;
}

export function detectRateDisclosed(text: string): { rateDisclosed: boolean; hourlyRate?: number } {
  const match = text.match(/\$\s?(\d{2,4})\s*(?:-|to)?\s*\$?\d{0,4}\s*\/?\s*(hour|hr|h\b)/i);
  if (!match) return { rateDisclosed: false };
  return { rateDisclosed: true, hourlyRate: Number(match[1]) };
}

export function buildRawSignal(params: {
  sourceConnector: string;
  vertical: Vertical;
  projectName: string;
  website?: string;
  signalText: string;
  evidenceUrl?: string;
  postedAt?: Date;
  extraMeta?: Record<string, unknown>;
  raw: unknown;
}): RawSignal {
  const rateInfo = detectRateDisclosed(params.signalText);
  return {
    sourceConnector: params.sourceConnector,
    vertical: params.vertical,
    projectName: params.projectName,
    website: params.website,
    signalText: params.signalText,
    evidenceUrl: params.evidenceUrl,
    discoveredAt: new Date(),
    meta: {
      postedAt: params.postedAt,
      ...rateInfo,
      ...params.extraMeta,
    },
    raw: params.raw,
  };
}

export function roleKeywordsFrom(config: SearchConfig): string[] {
  return config.keywords && config.keywords.length > 0 ? config.keywords : DEFAULT_ROLE_KEYWORDS;
}
