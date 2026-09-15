import type { RawSignal, SearchConfig, SourceConnector } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";
import { isProviderEnabled } from "../../provider-gate.js";
import { buildRawSignal } from "../job-boards/shared.js";

const BASE_URL = "https://google.serper.dev/maps";
const MAX_QUERIES = 5;

interface SerperMapsPlace {
  title: string;
  address?: string;
  category?: string;
  phoneNumber?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  cid?: string;
}

interface SerperMapsResponse {
  places?: SerperMapsPlace[];
}

async function searchMaps(query: string, apiKey: string): Promise<SerperMapsPlace[]> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query }),
  });
  if (!res.ok) throw new Error(`Serper Maps API error: ${res.status}`);
  const data = (await res.json()) as SerperMapsResponse;
  return data.places ?? [];
}

/**
 * One query per keyword×geography pair, e.g. "plumbers in Austin". Capped at
 * MAX_QUERIES so a search config with a long keyword/geography list can't
 * blow through Serper's per-search-run credit budget silently.
 */
function buildQueries(config: SearchConfig): string[] {
  const keywords = config.keywords && config.keywords.length > 0 ? config.keywords : [""];
  const geographies = config.geography && config.geography.length > 0 ? config.geography : [""];
  const queries: string[] = [];
  for (const keyword of keywords) {
    for (const geo of geographies) {
      if (!keyword && !geo) continue;
      queries.push([keyword, geo].filter(Boolean).join(" in ").trim());
      if (queries.length >= MAX_QUERIES) return queries;
    }
  }
  return queries;
}

/**
 * Local businesses with no website on file — the direct pitch for the user's
 * own marketing/web services, not a hiring or ad-spend signal like the other
 * "general" connectors. Businesses that already have a website are dropped:
 * that's the entire point of this source (see local-business/README note in
 * the top-level README), not a filter to relax later.
 */
export const serperMapsConnector: SourceConnector = {
  name: "serper-maps",
  vertical: ["general"],
  enabled: true,
  requiresApiKey: true,
  async fetch(config: SearchConfig): Promise<RawSignal[]> {
    const apiKey = process.env.SERPER_API_KEY ?? (await getProviderSecret("serper"));
    if (!apiKey) {
      console.warn("[serper-maps] no API key (env or Integrations page), skipping connector.");
      return [];
    }
    if (!(await isProviderEnabled("serper"))) return [];

    const queries = buildQueries(config);
    if (queries.length === 0) {
      console.warn("[serper-maps] no keywords/geography configured, skipping — nothing to search for.");
      return [];
    }

    const signals: RawSignal[] = [];
    const seenNames = new Set<string>();

    for (const query of queries) {
      const places = await searchMaps(query, apiKey);
      for (const place of places) {
        if (place.website || seenNames.has(place.title)) continue;
        seenNames.add(place.title);

        signals.push(
          buildRawSignal({
            sourceConnector: "serper-maps",
            vertical: "general",
            projectName: place.title,
            signalText: [place.category, place.address].filter(Boolean).join(" — ") || place.title,
            evidenceUrl: place.cid ? `https://www.google.com/maps?cid=${place.cid}` : undefined,
            extraMeta: {
              hasWebsite: false,
              category: place.category,
              rating: place.rating,
              ratingCount: place.ratingCount,
              phoneNumber: place.phoneNumber,
              address: place.address,
              matchedQuery: query,
            },
            raw: place,
          })
        );
      }
    }

    return signals;
  },
};
