import type { RawContact } from "@leads/core";
import { getProviderSecret } from "@leads/db/secrets.js";
import { isProviderEnabled } from "../../provider-gate.js";

const SEARCH_URL = "https://api.peopledatalabs.com/v5/person/search";

// Same decision-maker filter the other enrichment providers use — whoever
// PDL found at the domain still has to look like someone who buys marketing
// services, not just anyone on the payroll.
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

interface PdlEmail {
  address?: string | null;
  type?: string | null;
}

interface PdlPerson {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  work_email?: string | null;
  emails?: PdlEmail[] | null;
}

interface PdlSearchResponse {
  status?: number;
  error?: { message?: string; type?: string } | null;
  data?: PdlPerson[] | null;
}

function bestEmail(person: PdlPerson): string | null {
  if (person.work_email) return person.work_email;
  const professional = person.emails?.find((e) => e.type === "professional" || e.type === "work");
  return professional?.address ?? person.emails?.[0]?.address ?? null;
}

function fullName(person: PdlPerson): string {
  if (person.full_name?.trim()) return person.full_name.trim();
  return [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
}

/**
 * Fourth contact-enrichment provider alongside Hunter, Prospeo and Apollo —
 * People Data Labs' Person Search API, scoped to the company's domain.
 * Fields are read defensively (work_email first, else the first professional
 * entry in `emails`) since PDL's exact response shape varies by plan and
 * requested fields; a field it doesn't return just yields no contact rather
 * than throwing mid-pipeline.
 */
export async function enrichContactsViaPdl(domain: string): Promise<RawContact[]> {
  const apiKey = process.env.PDL_API_KEY ?? (await getProviderSecret("pdl"));
  if (!apiKey) {
    console.warn("[pdl] no API key (env or Integrations page), skipping enrichment.");
    return [];
  }

  if (!(await isProviderEnabled("pdl"))) return [];

  const query = {
    bool: {
      must: [{ term: { job_company_website: domain } }],
    },
  };

  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({ query, size: 10, pretty: false }),
  });

  if (!res.ok) {
    // 404 (no matches) and 402 (out of credits) are expected operating
    // conditions for an optional provider, not pipeline failures.
    if (res.status === 404 || res.status === 402) {
      console.warn(`[pdl] ${domain}: ${res.status}, skipping.`);
      return [];
    }
    throw new Error(`PDL API error for ${domain}: ${res.status}`);
  }

  const data = (await res.json()) as PdlSearchResponse;
  const people = data.data ?? [];

  return people
    .map((person) => ({ person, email: bestEmail(person) }))
    .filter((row): row is { person: PdlPerson; email: string } => !!row.email)
    .filter(({ person }) => {
      const title = (person.job_title ?? "").toLowerCase();
      return !title || DECISION_MAKER_TITLE_KEYWORDS.some((keyword) => title.includes(keyword));
    })
    .map(({ person, email }) => ({
      name: fullName(person) || email,
      title: person.job_title ?? "",
      contactMethod: "pdl_verified_email",
      contactValue: email,
    }));
}
