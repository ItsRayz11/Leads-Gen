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
