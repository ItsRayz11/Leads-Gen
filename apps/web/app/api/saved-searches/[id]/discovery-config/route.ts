import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/api-auth";
import { createClient } from "../../../../../lib/supabase/server";
import { isFiltersEmpty, normalizeFilters, VERTICALS } from "../../../../../lib/ai/search-filters";
import type { LeadVertical } from "@leads/db/types.js";

/**
 * Promotes an interpreted saved search into a `search_configs` row — the
 * machine-facing table the workers pipeline actually reads. This is what makes
 * an interpreted natural-language search change what discovery looks for,
 * rather than only what the dashboard filters.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = await createClient();

  const { data: search, error: fetchError } = await supabase
    .from("saved_searches")
    .select("name, query_text, filters, vertical")
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

  const vertical = filters.vertical ?? search.vertical;
  if (!vertical || !(VERTICALS as readonly string[]).includes(vertical)) {
    return NextResponse.json(
      { error: `A discovery config needs a vertical (${VERTICALS.join(", ")}).` },
      { status: 422 }
    );
  }

  const keywords = [...filters.keywords, ...filters.roleKeywords, ...filters.signalTypes, ...filters.serviceTypes];
  const geography = [...filters.countries, ...filters.regions];

  const { data, error } = await supabase
    .from("search_configs")
    .insert({
      vertical: vertical as LeadVertical,
      name: search.name,
      keywords: keywords.length > 0 ? Array.from(new Set(keywords)) : null,
      industries: filters.industries.length > 0 ? filters.industries : null,
      geography: geography.length > 0 ? geography : null,
      exclude_keywords: filters.excludeKeywords.length > 0 ? filters.excludeKeywords : null,
      live_search_providers: filters.liveSearchProviders.length > 0 ? filters.liveSearchProviders : null,
      enabled: true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ searchConfigId: data.id });
}
