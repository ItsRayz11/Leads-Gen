import { fileURLToPath } from "node:url";
import type { RawSignal, Vertical } from "@leads/core";
import type { Freshness } from "@leads/db/types.js";

/**
 * True when this module was invoked directly as a CLI script (`tsx foo.ts`),
 * false when it was merely imported as a library (e.g. by the Next.js API
 * route that triggers discovery in-browser). Bundlers that shim
 * `import.meta.url` for a Node server bundle (webpack, for the API route)
 * can hand `fileURLToPath` a value it rejects, so this fails safe rather than
 * crashing the importer.
 */
export function isRunAsScript(importMetaUrl: string): boolean {
  try {
    return process.argv[1] === fileURLToPath(importMetaUrl);
  } catch {
    return false;
  }
}

/** One connector's contribution to a discovery run, plus why it found nothing when that's not obvious from the count alone. */
export interface ConnectorCount {
  connector: string;
  signalsFound: number;
  note?: string;
}

/** What a vertical run reports back to the Discovery page. `note` is a run-level explanation (e.g. no search configs at all), distinct from a per-connector one. */
export interface RunResult {
  signalsFound: number;
  connectorCounts: ConnectorCount[];
  leadsUpserted: { companyName: string; score: number }[];
  note?: string;
}

export const VERTICAL_LEAD_TITLE: Record<Vertical, string> = {
  hiring: "Hiring signal opportunity",
  general: "General B2B/B2C opportunity",
  card_affiliate: "Bitget Card affiliate opportunity",
};

/**
 * The company dedupe key. Returns null when there is no usable hostname, so
 * callers fall back to matching on the project name.
 *
 * The scheme test is deliberately case-insensitive and covers any scheme, not
 * just http: prefixing "https://" onto a value that already starts with a
 * scheme ("HTTP://acme.com", "ftp://acme.com") makes the *scheme* parse as the
 * hostname, which would key every such company under one bogus domain and
 * merge unrelated companies into a single record.
 */
export function normalizeDomain(website: string | undefined | null): string | null {
  const trimmed = website?.trim();
  if (!trimmed) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  try {
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    // A non-web scheme isn't a domain we can dedupe on.
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

const FRESHNESS_DAYS = { fresh: 7, recent: 30, aging: 90 } as const;

export function freshnessFromDate(date: Date | string | null | undefined): Freshness {
  if (!date) return "unknown";
  const days = (Date.now() - new Date(date).getTime()) / 86_400_000;
  if (days <= FRESHNESS_DAYS.fresh) return "fresh";
  if (days <= FRESHNESS_DAYS.recent) return "recent";
  if (days <= FRESHNESS_DAYS.aging) return "aging";
  return "stale";
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * The dedupe rule: two raw signals describe the same opportunity when they
 * share a vertical and a company identity. Identity is the normalized domain
 * when a signal carries a website, and the normalized project name otherwise
 * — matching the schema, where `companies.domain` is the dedupe key and a
 * name is the fallback for a signal that has no link to go on.
 *
 * Keyed by vertical as well as company, so the same agency showing up as
 * both a hiring lead and a card-affiliate lead stays two opportunities.
 *
 * Pure and exported so the rule can be tested without a database; the
 * persistence around it lives in dedupe-and-upsert.ts.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  us: "United States", usa: "United States", "u.s.": "United States", "u.s.a.": "United States",
  uk: "United Kingdom", "u.k.": "United Kingdom",
  uae: "United Arab Emirates",
  drc: "Congo",
};

/**
 * Countries this business actually targets or hires from often enough that a
 * job posting's bare country name is worth bucketing into a broader region
 * (matches the REGIONS suggestions in apps/web/lib/ai/search-filters.ts).
 * Deliberately not exhaustive — an unlisted country still gets its `country`
 * field populated, just no `region`.
 */
const COUNTRY_TO_REGION: Record<string, string> = {
  "united states": "North America", canada: "North America",
  singapore: "Southeast Asia", philippines: "Southeast Asia", vietnam: "Southeast Asia",
  indonesia: "Southeast Asia", malaysia: "Southeast Asia", thailand: "Southeast Asia",
  india: "South Asia", pakistan: "South Asia", bangladesh: "South Asia", "sri lanka": "South Asia",
  china: "East Asia", japan: "East Asia", "south korea": "East Asia", "hong kong": "East Asia", taiwan: "East Asia",
  "united arab emirates": "Middle East", "saudi arabia": "Middle East", qatar: "Middle East",
  bahrain: "Middle East", kuwait: "Middle East", israel: "Middle East", turkey: "Middle East",
  nigeria: "Sub-Saharan Africa", kenya: "Sub-Saharan Africa", "south africa": "Sub-Saharan Africa", ghana: "Sub-Saharan Africa",
  egypt: "North Africa", morocco: "North Africa",
  "united kingdom": "Western Europe", germany: "Western Europe", france: "Western Europe",
  netherlands: "Western Europe", spain: "Western Europe", italy: "Western Europe", ireland: "Western Europe", portugal: "Western Europe",
  poland: "Eastern Europe", ukraine: "Eastern Europe", romania: "Eastern Europe", russia: "Eastern Europe",
  sweden: "Nordics", norway: "Nordics", denmark: "Nordics", finland: "Nordics",
  brazil: "Latin America", mexico: "Latin America", argentina: "Latin America", colombia: "Latin America",
  australia: "Oceania", "new zealand": "Oceania",
};

function titleCasePlace(value: string): string {
  return value
    .split(" ")
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

export interface ParsedLocation {
  country?: string;
  region?: string;
  city?: string;
}

/**
 * Heuristic parse of the free-text location strings job boards actually send
 * ("Remote", "Remote - US", "Lisbon, Portugal", "New York, NY, USA"). Good
 * enough to populate `companies.country`/`region`/`city` for most postings —
 * not a geocoder, so an unrecognized or ambiguous string just leaves fields
 * unset rather than guessing wrong.
 */
export function parseLocation(raw: string | undefined | null): ParsedLocation {
  const trimmed = raw?.trim();
  if (!trimmed) return {};

  if (/remote/i.test(trimmed)) {
    const suffixMatch = trimmed.match(/remote[\s\-–(]+([a-z .]+?)\)?\s*$/i);
    const suffix = suffixMatch?.[1]?.trim().toLowerCase();
    const country = suffix ? (COUNTRY_ALIASES[suffix] ?? titleCasePlace(suffix)) : undefined;
    const region = country ? COUNTRY_TO_REGION[country.toLowerCase()] : "Global / Remote";
    return { region: region ?? "Global / Remote", country };
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};

  const lastLower = parts[parts.length - 1].toLowerCase();
  const country = COUNTRY_ALIASES[lastLower] ?? (parts.length >= 2 ? titleCasePlace(parts[parts.length - 1]) : undefined);
  const city = parts.length >= 2 ? parts[0] : undefined;
  const region = country ? COUNTRY_TO_REGION[country.toLowerCase()] : undefined;

  return { country, city, region };
}

export function groupSignalsByCompany(rawSignals: RawSignal[]): Map<string, RawSignal[]> {
  const groups = new Map<string, RawSignal[]>();
  for (const signal of rawSignals) {
    const identity = normalizeDomain(signal.website) ?? normalizeName(signal.projectName);
    const key = `${signal.vertical}::${identity}`;
    const group = groups.get(key);
    if (group) group.push(signal);
    else groups.set(key, [signal]);
  }
  return groups;
}
