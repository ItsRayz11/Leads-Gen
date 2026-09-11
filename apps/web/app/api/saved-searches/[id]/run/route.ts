import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/api-auth";
import { createClient } from "../../../../../lib/supabase/server";
import { listLeads, type LeadListRow } from "../../../../../lib/data/leads";
import {
  filtersToJson,
  filtersToSearchParams,
  isFiltersEmpty,
  normalizeFilters,
} from "../../../../../lib/ai/search-filters";

const QUALIFIED_ONWARD = new Set([
  "qualified",
  "contacted",
  "follow_up",
  "replied",
  "meeting",
  "negotiation",
  "won",
]);

/**
 * Runs a saved search's structured filters against the leads already in the
 * database and logs the run to `search_history`.
 *
 * `saved_count` is always 0 here: this re-queries existing leads rather than
 * discovering new ones (discovery happens in the workers pipeline), so
 * nothing new gets saved. `qualified_count` is how many of the matches have
 * already reached "qualified" or later in the pipeline.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = await createClient();

  const { data: search, error: fetchError } = await supabase
    .from("saved_searches")
    .select("query_text, filters")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!search) return NextResponse.json({ error: "Saved search not found." }, { status: 404 });

  const filters = normalizeFilters(search.filters);
  if (isFiltersEmpty(filters)) {
    return NextResponse.json(
      { error: "This search has no structured filters yet — interpret it first." },
      { status: 422 }
    );
  }

  let matches: LeadListRow[];
  try {
    // No perPage: a run counts every match, so it reads them all rather than
    // one page of them.
    ({ rows: matches } = await listLeads({ structured: filters }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not run this search." },
      { status: 500 }
    );
  }

  const qualifiedCount = matches.filter((lead) => QUALIFIED_ONWARD.has(lead.status)).length;
  const runAt = new Date().toISOString();

  const [{ error: historyError }, { error: updateError }] = await Promise.all([
    supabase.from("search_history").insert({
      saved_search_id: id,
      query_text: search.query_text,
      filters: filtersToJson(filters),
      results_count: matches.length,
      qualified_count: qualifiedCount,
      saved_count: 0,
      run_at: runAt,
    }),
    supabase.from("saved_searches").update({ last_run_at: runAt }).eq("id", id),
  ]);

  if (historyError || updateError) {
    return NextResponse.json({ error: (historyError ?? updateError)!.message }, { status: 500 });
  }

  return NextResponse.json({
    resultsCount: matches.length,
    qualifiedCount,
    href: `/leads?savedSearch=${id}&${filtersToSearchParams(filters).toString()}`,
  });
}
