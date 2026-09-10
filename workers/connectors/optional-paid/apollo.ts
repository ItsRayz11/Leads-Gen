import type { RawContact } from "@leads/core";

const SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search";
const MATCH_URL = "https://api.apollo.io/api/v1/people/match";

const DEFAULT_TITLES = [
  "Head of Marketing",
  "Head of Community",
  "Head of Ecosystem",
  "Marketing Lead",
  "Community Manager",
  "Founder",
  "Co-Founder",
  "CEO",
  "VP Marketing",
  "Business Development",
];

interface ApolloSearchPerson {
  id: string;
  first_name: string;
  last_name_obfuscated: string;
  title: string | null;
  organization?: { name: string };
}

interface ApolloSearchResponse {
  people: ApolloSearchPerson[];
}

interface ApolloMatchResponse {
  person: { first_name: string; last_name: string; title: string | null; email: string | null } | null;
}

async function apolloRequest<T>(url: string, apiKey: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Apollo API error (${url}): ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Two Apollo API calls per lead (search, then match/reveal) — match/reveal
 * spends a credit, so this only enriches the single best-title candidate per
 * domain rather than every person Apollo finds there. Returns null rather
 * than guessing when nothing matches.
 */
export async function enrichContactViaApollo(
  domain: string,
  titles: string[] = DEFAULT_TITLES
): Promise<RawContact | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    console.warn("[apollo] APOLLO_API_KEY not set, skipping enrichment.");
    return null;
  }

  const searchResult = await apolloRequest<ApolloSearchResponse>(SEARCH_URL, apiKey, {
    q_organization_domains_list: [domain],
    person_titles: titles,
    include_similar_titles: true,
    per_page: 5,
  });

  const candidate = searchResult.people?.[0];
  if (!candidate) return null;

  const matchResult = await apolloRequest<ApolloMatchResponse>(MATCH_URL, apiKey, {
    id: candidate.id,
  });

  const person = matchResult.person;
  if (!person?.email) return null;

  return {
    name: `${person.first_name} ${person.last_name}`.trim(),
    title: person.title ?? candidate.title ?? "",
    contactMethod: "apollo_verified_email",
    contactValue: person.email,
  };
}
