import { createClient } from "../supabase/server";
import { rangeFor, type PageOptions, type PagedResult } from "../paging";

export interface NotificationListRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  related_lead_id: string | null;
  read: boolean;
  created_at: string;
  lead: { id: string; title: string; company: { name: string } | null } | null;
}

export interface NotificationFilters {
  unreadOnly?: boolean;
}

const NOTIFICATION_SELECT = `
  id, type, title, body, related_lead_id, read, created_at,
  lead:leads ( id, title, company:companies ( name ) )
`;

export async function listNotifications(
  filters: NotificationFilters = {},
  options: PageOptions = {}
): Promise<PagedResult<NotificationListRow>> {
  const supabase = await createClient();
  const { from, to } = rangeFor(options);

  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.unreadOnly) query = query.eq("read", false);

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as NotificationListRow[];
  return { rows, total: count ?? rows.length };
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}
