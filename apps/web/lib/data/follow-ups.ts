import { createClient } from "../supabase/server";

export interface FollowUpRow {
  id: string;
  title: string;
  status: string;
  tier: string | null;
  next_follow_up_at: string;
  company: { id: string; name: string } | null;
}

export interface FollowUpBuckets {
  overdue: FollowUpRow[];
  today: FollowUpRow[];
  tomorrow: FollowUpRow[];
  thisWeek: FollowUpRow[];
  upcoming: FollowUpRow[];
}

const FOLLOW_UP_SELECT = `
  id, title, status, tier, next_follow_up_at,
  company:companies!leads_company_id_fkey ( id, name )
`;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export async function getFollowUps(): Promise<FollowUpBuckets> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(FOLLOW_UP_SELECT)
    .not("next_follow_up_at", "is", null)
    .order("next_follow_up_at", { ascending: true });

  if (error) throw error;
  const leads = (data ?? []) as unknown as FollowUpRow[];

  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);
  // Week is assumed to run Monday–Sunday; "this week" ends on the upcoming Sunday.
  const dayOfWeek = today.getDay();
  const endOfWeek = dayOfWeek === 0 ? today : addDays(today, 7 - dayOfWeek);

  const buckets: FollowUpBuckets = { overdue: [], today: [], tomorrow: [], thisWeek: [], upcoming: [] };

  for (const lead of leads) {
    const due = startOfDay(new Date(lead.next_follow_up_at));
    if (due < today) buckets.overdue.push(lead);
    else if (due.getTime() === today.getTime()) buckets.today.push(lead);
    else if (due.getTime() === tomorrow.getTime()) buckets.tomorrow.push(lead);
    else if (due >= dayAfterTomorrow && due <= endOfWeek) buckets.thisWeek.push(lead);
    else buckets.upcoming.push(lead);
  }

  return buckets;
}
