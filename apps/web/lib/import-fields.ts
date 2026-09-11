import type { LeadStatus, LeadTier, LeadVertical } from "@leads/db/types.js";

/**
 * The parts of the CSV importer the /import wizard needs in the browser:
 * which fields exist, what they map to, and what the run options are.
 *
 * Split out from csv-import.ts on purpose — that module pulls in csv-parse
 * and the Supabase client, neither of which belongs in the client bundle.
 */

/**
 * An import writes row by row (a lead needs its company's id, which needs the
 * insert to have happened), so a very large file would outrun a serverless
 * function's time limit. The legacy CLI importer in workers/ has no such
 * limit and is the right tool above this size.
 */
export const MAX_IMPORT_ROWS = 1000;

export const VALID_VERTICALS: LeadVertical[] = ["hiring", "general", "card_affiliate", "live_search"];
export const VALID_TIERS: LeadTier[] = ["A+", "A", "B", "C", "Low Priority"];
export const VALID_STATUSES: LeadStatus[] = [
  "new", "researching", "qualified", "contacted", "follow_up", "replied",
  "meeting", "negotiation", "won",
  "no_response", "rejected", "not_interested", "not_a_fit", "lost", "on_hold",
];

export interface ImportField {
  key: string;
  label: string;
  /** What this field becomes once imported — shown under the mapping select. */
  hint: string;
  required?: boolean;
  /** Lower-cased header names matched automatically on upload. */
  synonyms: string[];
}

export const IMPORT_FIELDS: ImportField[] = [
  {
    key: "company",
    label: "Company",
    hint: "companies.name — required; a row without one can't be imported",
    required: true,
    synonyms: ["company", "company name", "project", "project name", "name", "organisation", "organization"],
  },
  {
    key: "website",
    label: "Website",
    hint: "companies.website, normalized into companies.domain — the dedupe key",
    synonyms: ["website", "url", "domain", "site", "web"],
  },
  { key: "country", label: "Country", hint: "companies.country", synonyms: ["country", "location"] },
  { key: "region", label: "Region", hint: "companies.region", synonyms: ["region", "continent", "area"] },
  {
    key: "industry",
    label: "Industry",
    hint: "companies.industry",
    synonyms: ["industry", "category", "sector", "niche"],
  },
  {
    key: "companySize",
    label: "Company size",
    hint: "companies.company_size",
    synonyms: ["company size", "size", "headcount", "employees"],
  },
  { key: "contactName", label: "Contact name", hint: "contacts.name", synonyms: ["contact", "contact name", "person", "full name"] },
  {
    key: "contactTitle",
    label: "Contact title",
    hint: "contacts.job_title",
    synonyms: ["title", "job title", "role", "position"],
  },
  {
    key: "contactEmail",
    label: "Contact email",
    hint: "contacts.email and contacts.contact_value",
    synonyms: ["email", "contact email", "e-mail", "email address"],
  },
  {
    key: "contactProfileUrl",
    label: "Contact profile",
    hint: "contacts.profile_url — LinkedIn/X/etc.",
    synonyms: ["profile", "profile url", "linkedin", "twitter", "x", "social"],
  },
  { key: "tier", label: "Tier", hint: `leads.tier — one of ${VALID_TIERS.join(", ")}`, synonyms: ["tier", "grade"] },
  { key: "score", label: "Score", hint: "leads.score — a number, clamped to 0–100", synonyms: ["score", "points", "rating"] },
  { key: "status", label: "Status", hint: "leads.status — defaults to the status chosen below", synonyms: ["status", "stage"] },
  {
    key: "signal",
    label: "Buying signal",
    hint: "leads.buying_signal_summary, and the part of the lead title that tells two opportunities apart",
    synonyms: ["signal", "buying signal", "reason", "trigger", "opportunity"],
  },
  {
    key: "serviceType",
    label: "Service",
    hint: "leads.service_type — which of your services this lead is for",
    synonyms: ["service", "service type", "offer"],
  },
  {
    key: "evidenceUrl",
    label: "Evidence URL",
    hint: "an evidence row linking to where the signal was found",
    synonyms: ["evidence", "evidence url", "source", "source url", "link", "proof"],
  },
  {
    key: "vertical",
    label: "Vertical",
    hint: "leads.vertical — defaults to the vertical chosen below",
    synonyms: ["vertical", "pipeline"],
  },
];

export type ImportFieldKey = string;
/** field key -> CSV header name. An absent or empty value means "ignore this field". */
export type ColumnMapping = Record<ImportFieldKey, string>;

export interface ImportOptions {
  /** Applied to rows with no vertical column, or an unrecognized value in one. */
  defaultVertical: LeadVertical;
  /** Applied to rows with no status column, or an unrecognized value in one. */
  defaultStatus: LeadStatus;
  /**
   * What to do when the company already has a lead with the same generated
   * title. "skip" leaves the existing lead alone (re-importing an updated
   * export doesn't duplicate it); "create" appends a numeric suffix.
   */
  onDuplicateLead: "skip" | "create";
  /**
   * Match rows with no website against existing companies by exact name.
   * Off by default — `domain` is the schema's dedupe key, and two unrelated
   * companies can share a name.
   */
  matchCompaniesByName: boolean;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  defaultVertical: "general",
  defaultStatus: "new",
  onDuplicateLead: "skip",
  matchCompaniesByName: false,
};

export function normalizeOptions(raw: unknown): ImportOptions {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const vertical = VALID_VERTICALS.find((v) => v === input.defaultVertical);
  const status = VALID_STATUSES.find((s) => s === input.defaultStatus);
  return {
    defaultVertical: vertical ?? DEFAULT_IMPORT_OPTIONS.defaultVertical,
    defaultStatus: status ?? DEFAULT_IMPORT_OPTIONS.defaultStatus,
    onDuplicateLead: input.onDuplicateLead === "create" ? "create" : "skip",
    matchCompaniesByName: input.matchCompaniesByName === true,
  };
}

