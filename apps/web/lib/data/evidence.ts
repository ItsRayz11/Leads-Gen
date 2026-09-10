import { createClient } from "../supabase/server";

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

export async function listEvidence(): Promise<EvidenceListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("evidence")
    .select(EVIDENCE_SELECT)
    .order("discovered_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data ?? []) as unknown as EvidenceListRow[];
}
