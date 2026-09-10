import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@leads/db/types.js";

type Client = SupabaseClient<Database>;
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";
const MAX_TITLE_ATTEMPTS = 50;

/**
 * `leads` has a unique index on (company_id, title), so a company can hold
 * several opportunities only while their titles differ. Callers that generate
 * a title from the company name (import, quick create) would otherwise fail
 * on the second lead for the same company — this retries with a numeric
 * suffix until a free title is found.
 */
export async function insertLeadWithUniqueTitle(
  supabase: Client,
  insert: LeadInsert
): Promise<{ id: string; title: string }> {
  const baseTitle = insert.title.trim() || "Untitled lead";

  for (let attempt = 1; attempt <= MAX_TITLE_ATTEMPTS; attempt++) {
    const title = attempt === 1 ? baseTitle : `${baseTitle} (${attempt})`;
    const { data, error } = await supabase
      .from("leads")
      .insert({ ...insert, title })
      .select("id, title")
      .single();

    if (!error) return { id: data.id, title: data.title };
    if (error.code !== UNIQUE_VIOLATION) throw error;
  }

  throw new Error(
    `Could not find a free lead title for "${baseTitle}" after ${MAX_TITLE_ATTEMPTS} attempts.`
  );
}

export interface EvidenceDraft {
  url?: string | null;
  description?: string | null;
  source?: string | null;
  sourceTitle?: string | null;
  sourceType?: string | null;
}

/**
 * `evidence.description` is NOT NULL, so a bare URL still needs a label —
 * callers that only have a link get a generic one rather than losing the link.
 */
export async function insertEvidence(
  supabase: Client,
  leadId: string,
  draft: EvidenceDraft,
  fallbackDescription: string
): Promise<void> {
  const url = draft.url?.trim() || null;
  const description = draft.description?.trim() || (url ? fallbackDescription : null);
  if (!url && !description) return;

  const { error } = await supabase.from("evidence").insert({
    lead_id: leadId,
    source: draft.source?.trim() || "manual",
    url,
    source_title: draft.sourceTitle?.trim() || null,
    source_type: draft.sourceType?.trim() || null,
    description: description ?? fallbackDescription,
  });
  if (error) throw error;
}

export type { LeadInsert, Json };
