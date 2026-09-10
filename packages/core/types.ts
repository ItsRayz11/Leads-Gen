export type Vertical = "hiring" | "general" | "card_affiliate";

/**
 * Matches the `leads.tier` check constraint in the database. "Low Priority"
 * exists so a lead that scores near zero is filed rather than dressed up as
 * a C — the UI and export already render all five.
 */
export type Tier = "A+" | "A" | "B" | "C" | "Low Priority";

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
