import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/api-auth";
import { candidateSlugs } from "../../../../lib/company-slug";

const FETCH_TIMEOUT_MS = 6000;

type Source = "greenhouse" | "lever" | "ashby";

interface Match {
  source: Source;
  identifier: string;
  jobCount: number;
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryGreenhouse(slug: string): Promise<Match | null> {
  const res = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  const jobs = data?.jobs;
  if (!Array.isArray(jobs)) return null;
  return { source: "greenhouse", identifier: slug, jobCount: jobs.length };
}

async function tryLever(slug: string): Promise<Match | null> {
  const res = await fetchWithTimeout(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data)) return null;
  return { source: "lever", identifier: slug, jobCount: data.length };
}

async function tryAshby(slug: string): Promise<Match | null> {
  const res = await fetchWithTimeout(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  const jobs = data?.jobs;
  if (!Array.isArray(jobs)) return null;
  return { source: "ashby", identifier: slug, jobCount: jobs.length };
}

/**
 * Guesses whether a company has a public Greenhouse/Lever/Ashby board, so the
 * Integrations page can offer a name search instead of making the user hunt
 * down the exact board token/slug themselves. Agency websites aren't covered
 * here — there's no API to resolve those against, they're just URLs the user
 * has already found.
 */
export async function GET(req: NextRequest) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const slugs = candidateSlugs(name);
  if (slugs.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const attempts = slugs.flatMap((slug) => [tryGreenhouse(slug), tryLever(slug), tryAshby(slug)]);
  const settled = await Promise.all(attempts);
  const results = settled.filter((r): r is Match => r !== null);

  const bestBySource = new Map<Source, Match>();
  for (const r of results) {
    const existing = bestBySource.get(r.source);
    if (!existing || r.jobCount > existing.jobCount) bestBySource.set(r.source, r);
  }

  return NextResponse.json({ matches: Array.from(bestBySource.values()) });
}
