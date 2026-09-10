import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { filtersToJson, normalizeFilters } from "../../../lib/ai/search-filters";

interface SavedSearchInput {
  name: string;
  queryText?: string;
  filters?: unknown;
  vertical?: string;
}

export async function POST(req: NextRequest) {
  const input = (await req.json()) as SavedSearchInput;
  if (!input.name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      name: input.name,
      query_text: input.queryText ?? null,
      filters: filtersToJson(normalizeFilters(input.filters)),
      vertical: input.vertical ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ savedSearch: data });
}
