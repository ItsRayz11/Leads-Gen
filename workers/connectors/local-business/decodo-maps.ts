import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";
import { isProviderEnabled } from "../../provider-gate.js";
import { buildRawSignal } from "../job-boards/shared.js";

const BASE_URL = "https://scraper-api.decodo.com/v2/scrape";
const MAX_QUERIES = 5;

/**
 * Decodo's Google Maps result shape, defensively typed: this connector was
 * written against Decodo's documented "google_maps_search" target without
 * live credentials to verify the response against, so field names are
 * guessed from their docs and re-checked at read time with fallbacks rather
 * than assumed exact. Tighten this once real output has been seen.
 */
interface DecodoMapsResult {
  name?: string;
  title?: string;
  category?: string;
  categories?: string[];
  address?: string;
  phone?: string;
  phoneNumber?: string;
  site?: string;
  website?: string;
  rating?: number;
  reviews_count?: number;
  ratingCount?: number;
  url?: string;
}

interface DecodoScrapeResponse {
  results?: Array<{ content?: { results?: DecodoMapsResult[] } | DecodoMapsResult[] }>;
}

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

/**
 * The Integrations page stores one secret string per provider, so a
 * username+password pair is packed as "username:password" in the single
 * "decodo" row. Env vars keep the two separate since that's the more natural
 * shape for a .env file.
 */
async function resolveCredentials(): Promise<{ username: string; password: string } | null> {
  const envUser = process.env.DECODO_USERNAME;
  const envPass = process.env.DECODO_PASSWORD;
  if (envUser && envPass) return { username: envUser, password: envPass };

  const packed = await getProviderSecret("decodo");
  if (!packed || !packed.includes(":")) return null;
  const separatorIndex = packed.indexOf(":");
  return { username: packed.slice(0, separatorIndex), password: packed.slice(separatorIndex + 1) };
}

function extractResults(data: DecodoScrapeResponse): DecodoMapsResult[] {
  const first = data.results?.[0]?.content;
  if (!first) return [];
  return Array.isArray(first) ? first : (first.results ?? []);
}

async function searchMaps(query: string, geo: string, authHeader: string): Promise<DecodoMapsResult[]> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ target: "google_maps_search", query, geo: geo || undefined, parse: true }),
  });
  if (!res.ok) throw new Error(`Decodo scraper API error: ${res.status}`);
  return extractResults((await res.json()) as DecodoScrapeResponse);
}

function buildQueries(config: SearchConfig): Array<{ query: string; geo: string }> {
  const keywords = config.keywords && config.keywords.length > 0 ? config.keywords : [];
  const geographies = config.geography && config.geography.length > 0 ? config.geography : [""];
  const queries: Array<{ query: string; geo: string }> = [];
  for (const keyword of keywords) {
    for (const geo of geographies) {
      queries.push({ query: keyword, geo });
      if (queries.length >= MAX_QUERIES) return queries;
    }
  }
  return queries;
}

/**
 * A general local-business Maps source, unlike serper-maps.ts it does NOT
 * filter to businesses missing a website — pointed at a keyword like
 * "marketing agency" this is just as useful for card-affiliate-style agency
 * discovery as for the no-website pitch. Running it alongside serper-maps
 * for the same query finds businesses either provider's index missed, per
 * the "more providers = more corroboration, not a replacement" pattern
 * already used for live search (see run-vertical4-live-search.ts).
 */
export const decodoMapsConnector: SourceConnector = {
  name: "decodo-maps",
  vertical: ["general"],
  enabled: true,
  requiresApiKey: true,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const credentials = await resolveCredentials();
    if (!credentials) {
      console.warn(
        "[decodo-maps] no credentials (DECODO_USERNAME+DECODO_PASSWORD env, or a \"username:password\" secret on the Integrations page), skipping connector."
      );
      return [];
    }
    if (!(await isProviderEnabled("decodo"))) return [];

    const queries = buildQueries(config);
    if (queries.length === 0) {
      console.warn("[decodo-maps] no keywords configured, skipping — nothing to search for.");
      return [];
    }

    const authHeader = basicAuthHeader(credentials.username, credentials.password);
    const signals: RawSignal[] = [];
    const seenNames = new Set<string>();

    for (const { query, geo } of queries) {
      const results = await searchMaps(query, geo, authHeader);
      for (const result of results) {
        const name = result.name ?? result.title;
        if (!name || seenNames.has(name)) continue;
        seenNames.add(name);

        const website = result.website ?? result.site;
        const category = result.category ?? result.categories?.[0];
        const ratingCount = result.reviews_count ?? result.ratingCount;

        signals.push(
          buildRawSignal({
            sourceConnector: "decodo-maps",
            vertical: "general",
            projectName: name,
            website,
            signalText: [category, result.address].filter(Boolean).join(" — ") || name,
            evidenceUrl: result.url,
            extraMeta: {
              hasWebsite: Boolean(website),
              category,
              rating: result.rating,
              ratingCount,
              phoneNumber: result.phone ?? result.phoneNumber,
              address: result.address,
              matchedQuery: query,
            },
            raw: result,
          })
        );
      }
    }

    return signals;
  },
};
