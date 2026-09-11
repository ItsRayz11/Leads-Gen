import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { getFilterOptions } from "../../../lib/data/filter-options";

/**
 * Backs the Discovery filter dropdowns. Returns the real option list for
 * every field that doesn't already have a fixed enum shipped in the client
 * bundle (search-filters.ts) — see getFilterOptions for how curated seeds
 * and live database values are merged.
 */
export async function GET() {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  try {
    const options = await getFilterOptions();
    return NextResponse.json({ options });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load filter options." },
      { status: 500 }
    );
  }
}
