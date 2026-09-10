import { createClient } from "../supabase/server";
import { rangeFor, type PageOptions, type PagedResult } from "../paging";

export interface EvidenceListRow {
  id: string;
  lead_id: string;
  source: string;
  url: string | null;
  source_title: string | null;
  source_type: string | null;
  description: string;
  published_at: string | null;
  discovered_at: string;
  freshness: string | null;
  confidence: number | null;
  lead: { id: string; title: string; company: { name: string } | null } | null;
}

const EVIDENCE_SELECT = `
  id, lead_id, source, url, source_title, source_type, description,
  published_at, discovered_at, freshness, confidence,
  lead:leads ( id, title, company:companies ( name ) )
`;

export async function listEvidence(
  options: PageOptions = {}
): Promise<PagedResult<EvidenceListRow>> {
  const supabase = await createClient();
  const { from, to } = rangeFor(options);

  const { data, error, count } = await supabase
    .from("evidence")
    .select(EVIDENCE_SELECT, { count: "exact" })
    .order("discovered_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) throw error;
  const rows = (data ?? []) as unknown as EvidenceListRow[];
  return { rows, total: count ?? rows.length };
}
