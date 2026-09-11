import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/api-auth";
import { createClient } from "../../../../lib/supabase/server";
import { filtersToJson, normalizeFilters } from "../../../../lib/ai/search-filters";
import type { Json } from "@leads/db/types.js";

interface SavedSearchPatch {
  name?: string;
  queryText?: string | null;
  filters?: unknown;
  vertical?: string | null;
  markRun?: boolean;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const input = (await req.json()) as SavedSearchPatch;

  const patch: {
    name?: string;
    query_text?: string | null;
    vertical?: string | null;
    filters?: Json;
    last_run_at?: string;
  } = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.queryText !== undefined) patch.query_text = input.queryText;
  if (input.vertical !== undefined) patch.vertical = input.vertical;
  if (input.filters !== undefined) patch.filters = filtersToJson(normalizeFilters(input.filters));
  if (input.markRun) patch.last_run_at = new Date().toISOString();

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("saved_searches").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("saved_searches").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
