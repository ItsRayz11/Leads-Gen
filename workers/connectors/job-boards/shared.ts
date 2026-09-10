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
