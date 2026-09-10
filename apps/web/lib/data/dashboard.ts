import { createClient } from "../supabase/server";

export interface DashboardMetrics {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  tierCounts: Record<string, number>;
  highIntent: number;
  needsVerification: number;
  contacted: number;
  awaitingReply: number;
  followUpsDueToday: number;
  overdueFollowUps: number;
  meetings: number;
  negotiations: number;
  won: number;
  lost: number;
}

export interface TodayWorkItem {
  id: string;
  title: string;
  companyName: string | null;
  dueDate: string | null;
  kind: "overdue_followup" | "followup_today" | "high_intent" | "needs_research" | "overdue_task";
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient();

  const [leadsRes, tierRes] = await Promise.all([
    supabase.from("leads").select("id, status, next_follow_up_at, verification_status, signal_strength"),
    supabase.from("leads").select("tier"),
  ]);

  const leads = leadsRes.data ?? [];
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const tierCounts: Record<string, number> = {};
  for (const row of tierRes.data ?? []) {
    const tier = row.tier ?? "Unscored";
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
  }

  const followUpDue = (l: (typeof leads)[number]) =>
    l.next_follow_up_at ? new Date(l.next_follow_up_at) : null;

  return {
    totalLeads: leads.length,
    newLeads: leads.filter((l) => l.status === "new").length,
    qualifiedLeads: leads.filter((l) => l.status === "qualified").length,
    tierCounts,
    highIntent: leads.filter((l) => l.signal_strength === "strong").length,
    needsVerification: leads.filter((l) => l.verification_status === "needs_verification").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    awaitingReply: leads.filter((l) => l.status === "follow_up").length,
    followUpsDueToday: leads.filter((l) => {
      const d = followUpDue(l);
      return d && d >= startOfToday && d < endOfToday;
    }).length,
    overdueFollowUps: leads.filter((l) => {
      const d = followUpDue(l);
      return d && d.getTime() < now && d < startOfToday;
    }).length,
    meetings: leads.filter((l) => l.status === "meeting").length,
    negotiations: leads.filter((l) => l.status === "negotiation").length,
    won: leads.filter((l) => l.status === "won").length,
    lost: leads.filter((l) => ["lost", "rejected", "not_interested", "not_a_fit"].includes(l.status))
      .length,
  };
}

export async function getTodaysWork(): Promise<{
  overdueFollowUps: TodayWorkItem[];
  todayFollowUps: TodayWorkItem[];
  highIntentNew: TodayWorkItem[];
  overdueTasks: TodayWorkItem[];
}> {
  const supabase = await createClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [leadsRes, tasksRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, title, next_follow_up_at, signal_strength, status, company:companies(name)")
      .not("next_follow_up_at", "is", null)
      .order("next_follow_up_at", { ascending: true })
      .limit(50),
    supabase
      .from("tasks")
      .select("id, title, due_date, lead:leads(company:companies(name))")
      .in("status", ["pending", "in_progress"])
      .not("due_date", "is", null)
      .lt("due_date", startOfToday.toISOString().slice(0, 10))
      .order("due_date", { ascending: true })
      .limit(20),
  ]);

  const leads = leadsRes.data ?? [];
  const overdueFollowUps: TodayWorkItem[] = [];
  const todayFollowUps: TodayWorkItem[] = [];

  for (const lead of leads) {
    const due = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
    if (!due) continue;
    const item: TodayWorkItem = {
      id: lead.id,
      title: lead.title,
      companyName: (lead.company as { name: string } | null)?.name ?? null,
      dueDate: lead.next_follow_up_at,
      kind: due < startOfToday ? "overdue_followup" : "followup_today",
    };
    if (due < startOfToday) overdueFollowUps.push(item);
    else if (due >= startOfToday && due < endOfToday) todayFollowUps.push(item);
  }

  const highIntentRes = await supabase
    .from("leads")
    .select("id, title, status, company:companies(name)")
    .eq("signal_strength", "strong")
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(10);

  const highIntentNew: TodayWorkItem[] = (highIntentRes.data ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    companyName: (l.company as { name: string } | null)?.name ?? null,
    dueDate: null,
    kind: "high_intent",
  }));

  const overdueTasks: TodayWorkItem[] = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    companyName: (t.lead as { company: { name: string } | null } | null)?.company?.name ?? null,
    dueDate: t.due_date,
    kind: "overdue_task",
  }));

  return { overdueFollowUps, todayFollowUps, highIntentNew, overdueTasks };
}
