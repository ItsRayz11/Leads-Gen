import { createClient } from "../supabase/server";

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

export async function listOutreach(): Promise<OutreachListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outreach")
    .select(OUTREACH_SELECT)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data ?? []) as unknown as OutreachListRow[];
}
