import type { Json } from "@leads/db/types.js";
import { LIVE_SEARCH_PROVIDERS } from "@leads/core";
export { LIVE_SEARCH_PROVIDERS, LIVE_SEARCH_PROVIDER_LABELS, type LiveSearchProvider } from "@leads/core";

/**
 * The structured shape a natural-language discovery query is interpreted
 * into. Every field maps onto a real column this app can actually filter on
 * (see `applySearchFilters` in lib/data/leads.ts) — nothing here is
 * decorative, so an interpreted search can be re-run against the database
 * rather than just re-read as text.
 */
export interface StructuredSearchFilters {
  keywords: string[];
  excludeKeywords: string[];
  roleKeywords: string[];
  industries: string[];
  countries: string[];
  regions: string[];
  companySizes: string[];
  signalTypes: string[];
  serviceTypes: string[];
  tiers: string[];
  statuses: string[];
  freshness: string[];
  minScore: number | null;
  vertical: string | null;
  /** live_search only — which AI provider(s) run the web search. Empty means "use the default" (Google/Gemini alone). */
  liveSearchProviders: string[];
}

export const EMPTY_FILTERS: StructuredSearchFilters = {
  keywords: [],
  excludeKeywords: [],
  roleKeywords: [],
  industries: [],
  countries: [],
  regions: [],
  companySizes: [],
  signalTypes: [],
  serviceTypes: [],
  tiers: [],
  statuses: [],
  freshness: [],
  minScore: null,
  vertical: null,
  liveSearchProviders: [],
};

export const VERTICALS = ["hiring", "general", "card_affiliate", "live_search"] as const;
export const TIERS = ["A+", "A", "B", "C", "Low Priority"] as const;
export const FRESHNESS_VALUES = ["fresh", "recent", "aging", "stale", "unknown"] as const;

/**
 * Suggestion lists for the dropdown UI and the AI interpretation prompt.
 * Unlike TIERS/STATUSES/FRESHNESS_VALUES below, these are NOT enforced in
 * normalizeFilters — industries/countries/signal types/company sizes stay
 * free text underneath so a value outside the list (a niche industry, a
 * territory not listed) still works, typed instead of clicked.
 */
export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10001+",
] as const;

export const SIGNAL_TYPES = [
  "hiring",
  "launch",
  "fundraising",
  "expansion",
  "partnership",
  "product_update",
  "rebrand",
  "acquisition",
  "award",
  "event",
  "leadership_change",
  "layoffs",
  "ipo",
  "office_opening",
] as const;

export const INDUSTRIES = [
  "Web3 / Crypto",
  "DeFi",
  "NFT",
  "GameFi / Gaming",
  "Blockchain Infrastructure",
  "Digital Marketing",
  "Performance Marketing",
  "Community Management",
  "Public Relations",
  "Influencer Marketing",
  "SaaS",
  "Fintech",
  "Payments",
  "E-commerce",
  "Retail",
  "Advertising",
  "Media & Entertainment",
  "Social Media",
  "Consumer Apps",
  "Enterprise Software",
  "AI / Machine Learning",
  "Cybersecurity",
  "Cloud Computing",
  "Telecommunications",
  "Healthcare",
  "Biotechnology",
  "Pharmaceuticals",
  "Education / EdTech",
  "Real Estate / PropTech",
  "Travel & Hospitality",
  "Transportation & Logistics",
  "Automotive",
  "Manufacturing",
  "Energy",
  "Renewable Energy",
  "Agriculture",
  "Food & Beverage",
  "Consumer Goods",
  "Retail Banking",
  "Insurance",
  "Legal Services",
  "Human Resources",
  "Recruiting / Staffing",
  "Nonprofit",
  "Government",
  "Sports",
  "Fashion & Apparel",
  "Beauty & Personal Care",
  "Gaming Hardware",
  "VR / AR",
  "Robotics",
  "IoT",
  "Data & Analytics",
  "Venture Capital",
  "Private Equity",
  "Consulting",
] as const;

export const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana",
  "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon",
  "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo",
  "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica",
  "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia",
  "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany",
  "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras",
  "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
  "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein",
  "Lithuania", "Luxembourg", "Macau", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
  "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco",
  "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia",
  "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay",
  "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone",
  "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
  "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
] as const;

/**
 * Curated seed lists for the fields that have no fixed database enum
 * (regions/service types/roles/exclusions are free text on `companies` and
 * `leads` — see lib/data/leads.ts). These are a starting taxonomy, not a
 * closed one: /api/filter-options merges them with whatever values already
 * exist in the database, and every field here still allows a typed custom
 * value through MultiSelect's `allowCustom`.
 */
export const REGIONS = [
  "Southeast Asia",
  "East Asia",
  "South Asia",
  "Middle East",
  "MENA",
  "GCC",
  "North America",
  "Latin America",
  "Western Europe",
  "Eastern Europe",
  "Nordics",
  "Sub-Saharan Africa",
  "North Africa",
  "Oceania",
  "CIS",
  "Global / Remote",
] as const;

export const ROLE_SUGGESTIONS = [
  "Head of Community",
  "Community Manager",
  "Community Lead",
  "Discord Moderator",
  "Social Media Manager",
  "Head of Marketing",
  "Marketing Manager",
  "Growth Manager",
  "Growth Lead",
  "Performance Marketing Manager",
  "KOL Manager",
  "Influencer Marketing Manager",
  "Content Manager",
  "PR Manager",
  "CMO",
  "Chief Marketing Officer",
  "Founder",
  "Co-Founder",
  "CEO",
  "Business Development Manager",
  "Partnerships Manager",
  "Recruiter",
  "Talent Acquisition Manager",
  "Operations Manager",
] as const;

export const SERVICE_TYPE_SUGGESTIONS = [
  "Community Management",
  "Discord Management",
  "Telegram Management",
  "Social Media Management",
  "KOL Marketing",
  "Influencer Marketing",
  "Content Marketing",
  "Digital Marketing",
  "Performance Marketing",
  "Growth Marketing",
  "Public Relations",
  "Marketing Consulting",
  "Bitget Card Affiliate",
  "Crypto Marketing",
  "Web3 Marketing",
] as const;

export const EXCLUDE_SUGGESTIONS = [
  "internship",
  "unpaid",
  "volunteer",
  "intern",
  "entry level",
  "junior",
  "freelance",
  "contract",
  "part time",
] as const;

export const STATUSES = [
  "new",
  "researching",
  "qualified",
  "contacted",
  "follow_up",
  "replied",
  "meeting",
  "negotiation",
  "won",
  "no_response",
  "rejected",
  "not_interested",
  "not_a_fit",
  "lost",
  "on_hold",
] as const;

export const FILTER_LABELS: Record<keyof StructuredSearchFilters, string> = {
  keywords: "Keywords",
  excludeKeywords: "Exclude",
  roleKeywords: "Roles",
  industries: "Industries",
  countries: "Countries",
  regions: "Regions",
  companySizes: "Company size",
  signalTypes: "Signal types",
  serviceTypes: "Services",
  tiers: "Tiers",
  statuses: "Statuses",
  freshness: "Freshness",
  minScore: "Min score",
  vertical: "Vertical",
  liveSearchProviders: "Live search providers",
};

const ARRAY_FIELDS = [
  "keywords",
  "excludeKeywords",
  "roleKeywords",
  "industries",
  "countries",
  "regions",
  "companySizes",
  "signalTypes",
  "serviceTypes",
  "tiers",
  "statuses",
  "freshness",
] as const satisfies readonly (keyof StructuredSearchFilters)[];

function toStringArray(value: unknown, allowed?: readonly string[], max = 20): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (allowed) {
      const match = allowed.find((a) => a.toLowerCase() === trimmed.toLowerCase());
      if (!match) continue;
      if (!out.includes(match)) out.push(match);
      continue;
    }
    if (!out.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) out.push(trimmed);
  }
  return out.slice(0, max);
}

/**
 * Coerces anything (a model's JSON, a `filters` jsonb column written by an
 * older version, hand-edited input) into a valid filter object. Unknown keys
 * and out-of-range enum values are dropped rather than passed through to a
 * query that would error.
 */
export function normalizeFilters(input: unknown): StructuredSearchFilters {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ...EMPTY_FILTERS };
  const raw = input as Record<string, unknown>;

  const minScoreRaw = raw.minScore;
  const minScoreNum =
    typeof minScoreRaw === "number"
      ? minScoreRaw
      : typeof minScoreRaw === "string" && minScoreRaw.trim() !== ""
        ? Number(minScoreRaw)
        : NaN;

  const verticalRaw = typeof raw.vertical === "string" ? raw.vertical.trim().toLowerCase() : "";
  const vertical = (VERTICALS as readonly string[]).includes(verticalRaw) ? verticalRaw : null;

  const liveSearchProvidersRaw = toStringArray(raw.liveSearchProviders, LIVE_SEARCH_PROVIDERS);
  // A live_search config with no explicit provider choice still needs to run
  // something — default to Google/Gemini alone, the one guaranteed already
  // configured (search interpretation depends on it too).
  const liveSearchProviders =
    vertical === "live_search" && liveSearchProvidersRaw.length === 0 ? ["google"] : liveSearchProvidersRaw;

  return {
    keywords: toStringArray(raw.keywords),
    excludeKeywords: toStringArray(raw.excludeKeywords),
    roleKeywords: toStringArray(raw.roleKeywords),
    industries: toStringArray(raw.industries),
    countries: toStringArray(raw.countries, undefined, 5),
    regions: toStringArray(raw.regions),
    companySizes: toStringArray(raw.companySizes),
    signalTypes: toStringArray(raw.signalTypes),
    serviceTypes: toStringArray(raw.serviceTypes),
    tiers: toStringArray(raw.tiers, TIERS),
    statuses: toStringArray(raw.statuses, STATUSES),
    freshness: toStringArray(raw.freshness, FRESHNESS_VALUES),
    minScore: Number.isFinite(minScoreNum) ? Math.min(100, Math.max(0, Math.round(minScoreNum))) : null,
    vertical,
    liveSearchProviders,
  };
}

export function isFiltersEmpty(filters: StructuredSearchFilters): boolean {
  return (
    ARRAY_FIELDS.every((field) => filters[field].length === 0) &&
    filters.minScore === null &&
    filters.vertical === null
  );
}

/** Human-readable one-liner for a filter set, used in tables and headers. */
export function describeFilters(filters: StructuredSearchFilters): string {
  const parts: string[] = [];
  for (const field of ARRAY_FIELDS) {
    const values = filters[field];
    if (values.length > 0) parts.push(`${FILTER_LABELS[field]}: ${values.join(", ")}`);
  }
  if (filters.vertical) parts.push(`${FILTER_LABELS.vertical}: ${filters.vertical.replace(/_/g, " ")}`);
  if (filters.vertical === "live_search" && filters.liveSearchProviders.length > 0) {
    parts.push(`${FILTER_LABELS.liveSearchProviders}: ${filters.liveSearchProviders.join(", ")}`);
  }
  if (filters.minScore !== null) parts.push(`${FILTER_LABELS.minScore}: ${filters.minScore}`);
  return parts.length > 0 ? parts.join(" · ") : "No structured filters";
}

/** Round-trips filters through URL search params so /leads can honor them. */
export function filtersToSearchParams(filters: StructuredSearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const field of ARRAY_FIELDS) {
    if (filters[field].length > 0) params.set(field, filters[field].join("|"));
  }
  if (filters.vertical) params.set("vertical", filters.vertical);
  if (filters.liveSearchProviders.length > 0) params.set("liveSearchProviders", filters.liveSearchProviders.join("|"));
  if (filters.minScore !== null) params.set("minScore", String(filters.minScore));
  return params;
}

export function filtersFromSearchParams(params: Record<string, string | string[] | undefined>): StructuredSearchFilters {
  const read = (key: string): string[] => {
    const value = params[key];
    const str = Array.isArray(value) ? value[0] : value;
    if (!str) return [];
    return str.split("|").map((s) => s.trim()).filter(Boolean);
  };
  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return normalizeFilters({
    keywords: read("keywords"),
    excludeKeywords: read("excludeKeywords"),
    roleKeywords: read("roleKeywords"),
    industries: read("industries"),
    countries: read("countries"),
    regions: read("regions"),
    companySizes: read("companySizes"),
    signalTypes: read("signalTypes"),
    serviceTypes: read("serviceTypes"),
    tiers: read("tiers"),
    statuses: read("statuses"),
    freshness: read("freshness"),
    minScore: single("minScore"),
    vertical: single("vertical"),
    liveSearchProviders: read("liveSearchProviders"),
  });
}

export function filtersToJson(filters: StructuredSearchFilters): Json {
  return filters as unknown as Json;
}
