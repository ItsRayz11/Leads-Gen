import type { RawContact } from "@leads/core";
import { isProviderEnabled } from "../../provider-gate.js";

const DOMAIN_SEARCH_URL = "https://api.prospeo.io/domain-search";

// Same decision-maker filter Hunter uses — whoever the provider found at the
// domain still has to look like someone who buys marketing services.
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

/**
 * Prospeo's domain-search response, per their documented shape:
 * `{ error: false, response: { email_list: [...] } }`, with an
 * `email_status` of "VALID" / "ACCEPT_ALL" / "UNKNOWN" per row. Field names
 * are read defensively (both `email_list` and `emails`, both `job_title` and
 * `position`) so a field rename on their side degrades to "found nothing"
 * rather than throwing mid-pipeline.
 */
interface ProspeoEmail {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  job_title?: string | null;
  position?: string | null;
  email_status?: string | null;
  verification?: { status?: string | null } | null;
}

interface ProspeoDomainSearchResponse {
  error?: boolean;
  message?: string;
  response?: {
    email_list?: ProspeoEmail[];
    emails?: ProspeoEmail[];
  } | null;
}

function emailStatus(entry: ProspeoEmail): string {
  return (entry.email_status ?? entry.verification?.status ?? "").toString().toLowerCase();
}

function jobTitle(entry: ProspeoEmail): string {
  return (entry.job_title ?? entry.position ?? "").trim();
}

function fullName(entry: ProspeoEmail): string {
  if (entry.full_name?.trim()) return entry.full_name.trim();
  return [entry.first_name, entry.last_name].filter(Boolean).join(" ").trim();
}

/**
 * Third contact-enrichment provider alongside Hunter and Apollo. Only
 * emails Prospeo itself marked valid are kept — "accept_all" and "unknown"
 * mean it could not confirm the mailbox exists, which is a guess, and this
 * workspace does not store guessed contact details.
 */
export async function enrichContactsViaProspeo(domain: string): Promise<RawContact[]> {
  const apiKey = process.env.PROSPEO_API_KEY;
  if (!apiKey) {
    console.warn("[prospeo] PROSPEO_API_KEY not set, skipping enrichment.");
    return [];
  }

  if (!(await isProviderEnabled("prospeo"))) return [];

  const res = await fetch(DOMAIN_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-KEY": apiKey },
    body: JSON.stringify({ company: domain, limit: 20 }),
  });

  if (!res.ok) {
    // 404 (no data for this domain) and 402 (out of credits) are expected
    // operating conditions for an optional provider, not pipeline failures.
    if (res.status === 404 || res.status === 402) {
      console.warn(`[prospeo] ${domain}: ${res.status}, skipping.`);
      return [];
    }
    throw new Error(`Prospeo API error for ${domain}: ${res.status}`);
  }

  const data = (await res.json()) as ProspeoDomainSearchResponse;
  if (data.error) {
    console.warn(`[prospeo] ${domain}: ${data.message ?? "provider returned an error"}, skipping.`);
    return [];
  }

  const entries = data.response?.email_list ?? data.response?.emails ?? [];

  return entries
    .filter((entry) => typeof entry.email === "string" && entry.email.includes("@"))
    .filter((entry) => emailStatus(entry) === "valid")
    .filter((entry) => {
      const title = jobTitle(entry).toLowerCase();
      return !title || DECISION_MAKER_TITLE_KEYWORDS.some((keyword) => title.includes(keyword));
    })
    .map((entry) => ({
      name: fullName(entry) || entry.email!,
      title: jobTitle(entry),
      contactMethod: "prospeo_verified_email",
      contactValue: entry.email!,
    }));
}
