import type { RawContact } from "@leads/core";

const BASE_URL = "https://api.hunter.io/v2/domain-search";

// Titles worth surfacing as a lead's primary contact — same idea as the
// job-board role-keyword filters, applied to whoever Hunter found at the
// domain rather than to a job posting.
const DECISION_MAKER_TITLE_KEYWORDS = [
  "marketing",
  "community",
  "growth",
  "founder",
  "ceo",
  "partnership",
  "business development",
  "ecosystem",
];

interface HunterEmail {
  value: string;
  type: string;
  confidence: number;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  verification: { status: string | null };
}

interface HunterDomainSearchResponse {
  data: { emails: HunterEmail[] };
}

/**
 * Only emails Hunter's own verification marked "valid" are used — this
 * respects the "public contact data only, no guessed emails" rule (Hunter's
 * "accept-all"/"unknown" statuses mean it couldn't actually confirm the
 * mailbox exists, which is functionally a guess).
 */
export async function enrichContactsViaHunter(domain: string): Promise<RawContact[]> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    console.warn("[hunter] HUNTER_API_KEY not set, skipping enrichment.");
    return [];
  }

  const params = new URLSearchParams({ domain, api_key: apiKey, limit: "20" });
  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 404) return []; // no data for this domain
    throw new Error(`Hunter API error for ${domain}: ${res.status}`);
  }

  const data = (await res.json()) as HunterDomainSearchResponse;
  const emails = data.data?.emails ?? [];

  return emails
    .filter((e) => e.verification?.status === "valid")
    .filter(
      (e) =>
        !e.position ||
        DECISION_MAKER_TITLE_KEYWORDS.some((k) => e.position!.toLowerCase().includes(k))
    )
    .map((e) => ({
      name: [e.first_name, e.last_name].filter(Boolean).join(" ") || e.value,
      title: e.position ?? "",
      contactMethod: "hunter_verified_email",
      contactValue: e.value,
    }));
}
