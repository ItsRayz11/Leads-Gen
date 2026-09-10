import { createClient } from "../supabase/server";
import { rangeFor, type PageOptions, type PagedResult } from "../paging";

export interface OutreachListRow {
  id: string;
  lead_id: string;
  contact_id: string | null;
  channel: string;
  direction: string;
  message: string | null;
  recipient: string | null;
  result: string | null;
  status: string;
  sent_at: string | null;
  follow_up_date: string | null;
  created_at: string;
  lead: { id: string; title: string; company: { name: string } | null } | null;
  contact: { id: string; name: string | null } | null;
}

const OUTREACH_SELECT = `
  id, lead_id, contact_id, channel, direction, message, recipient, result, status,
  sent_at, follow_up_date, created_at,
  lead:leads ( id, title, company:companies ( name ) ),
  contact:contacts ( id, name )
`;

export async function listOutreach(
  options: PageOptions = {}
): Promise<PagedResult<OutreachListRow>> {
  const supabase = await createClient();
  const { from, to } = rangeFor(options);

  const { data, error, count } = await supabase
    .from("outreach")
    .select(OUTREACH_SELECT, { count: "exact" })
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) throw error;
  const rows = (data ?? []) as unknown as OutreachListRow[];
  return { rows, total: count ?? rows.length };
}
