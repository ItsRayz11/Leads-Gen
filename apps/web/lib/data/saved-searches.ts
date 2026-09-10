import { createClient } from "../supabase/server";
import type { SavedSearch } from "@leads/db/types.js";
import { normalizeFilters, type StructuredSearchFilters } from "../ai/search-filters";

export interface SavedSearchRow extends SavedSearch {
  /** `filters` coerced into the structured shape the lead query understands. */
  parsedFilters: StructuredSearchFilters;
}

export async function listSavedSearches(): Promise<SavedSearchRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, parsedFilters: normalizeFilters(row.filters) }));
}

export async function getSavedSearch(id: string): Promise<SavedSearchRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("saved_searches").select("*").eq("id", id).maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { ...data, parsedFilters: normalizeFilters(data.filters) };
}
