export type Vertical = "hiring" | "general" | "card_affiliate" | "live_search";

/**
 * Matches the `leads.tier` check constraint in the database. "Low Priority"
 * exists so a lead that scores near zero is filed rather than dressed up as
 * a C — the UI and export already render all five.
 */
export type Tier = "A+" | "A" | "B" | "C" | "Low Priority";

/**
 * The dimensions a lead is scored across. Lives here rather than in the
 * scorer because both sides need the same vocabulary: the workers compute
 * them, and the web app renders them from the `lead_scores` columns.
 */
export const SCORE_DIMENSIONS = [
  "intent",
  "fit",
  "evidence",
  "freshness",
  "contactability",
  "companyQuality",
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  intent: "Intent",
  fit: "Fit",
  evidence: "Evidence",
  freshness: "Freshness",
  contactability: "Contactability",
  companyQuality: "Company quality",
};

/** What each dimension is measuring, shown as a hint next to its bar. */
export const DIMENSION_HINTS: Record<ScoreDimension, string> = {
  intent: "Is someone asking for this work, with budget, right now",
  fit: "Does the work match the services on offer",
  evidence: "Is there a citable source, and did more than one find it",
  freshness: "How current the signal is",
  contactability: "Whether there is a named person to reach",
  companyQuality: "Whether there is a real, funded team behind it",
};

/** The `lead_scores` column holding each dimension's score. */
export const DIMENSION_COLUMNS: Record<ScoreDimension, string> = {
  intent: "intent_score",
  fit: "fit_score",
  evidence: "evidence_score",
  freshness: "freshness_score",
  contactability: "contactability_score",
  companyQuality: "company_quality_score",
};

export interface RawContact {
  name: string;
  title: string;
  contactMethod: string; // 'twitter' | 'public_email_on_site' | 'company_form' | ...
  contactValue: string;
}

/**
 * What every connector produces, before scoring/dedupe/persistence.
 * `meta` carries the structured fields the scorer reads (rateDisclosed,
 * hourlyRate, postedAt, openRolesAtCompany, adSpendUsd, ...) — each vertical's
 * rule set knows which meta keys to look for.
 */
export interface RawSignal {
  sourceConnector: string;
  vertical: Vertical;
  projectName: string;
  website?: string;
  signalText: string;
  evidenceUrl?: string;
  contacts?: RawContact[];
  discoveredAt: Date;
  meta: Record<string, unknown>;
  raw: unknown;
}

export interface SearchConfig {
  vertical: Vertical;
  keywords?: string[];
  industries?: string[];
  geography?: string[];
  excludeKeywords?: string[];
  [key: string]: unknown;
}

export interface SourceConnector {
  name: string;
  vertical: Vertical[];
  enabled: boolean;
  requiresApiKey: boolean;
  fetch(config: SearchConfig): Promise<RawSignal[]>;
}
