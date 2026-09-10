import { createClient } from "../supabase/server";
import { rangeFor, type PageOptions, type PagedResult } from "../paging";

export interface SignalFilters {
  signalType?: string;
}

export interface SignalListRow {
  id: string;
  lead_id: string;
  signal_type: string;
  signal_strength: string | null;
  signal_description: string;
  signal_date: string | null;
  source: string | null;
  confidence: number | null;
  verification_status: string;
  freshness: string | null;
  is_primary: boolean;
  created_at: string;
  lead: { id: string; title: string; company: { name: string } | null } | null;
}

const SIGNAL_SELECT = `
  id, lead_id, signal_type, signal_strength, signal_description, signal_date,
  source, confidence, verification_status, freshness, is_primary, created_at,
  lead:leads ( id, title, company:companies ( name ) )
`;

export async function listSignals(
  filters: SignalFilters = {},
  options: PageOptions = {}
): Promise<PagedResult<SignalListRow>> {
  const supabase = await createClient();
  const { from, to } = rangeFor(options);

  let query = supabase
    .from("lead_signals")
    .select(SIGNAL_SELECT, { count: "exact" })
    .order("signal_date", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);

  if (filters.signalType) query = query.eq("signal_type", filters.signalType);

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as SignalListRow[];
  return { rows, total: count ?? rows.length };
}
