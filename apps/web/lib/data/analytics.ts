import { createClient } from "../supabase/server";

export interface CountBucket {
  label: string;
  count: number;
}

/** Reply performance for one slice of recorded outreach. */
export interface ReplyStat {
  label: string;
  sent: number;
  replied: number;
  replyRate: number | null;
}

export interface FollowUpPerformance {
  recorded: number;
  replied: number;
  replyRate: number | null;
  byChannel: ReplyStat[];
  byTouch: ReplyStat[];
  overdue: number;
  dueToday: number;
  scheduled: number;
  inFlightWithoutFollowUp: number;
}

export interface SegmentWinRate {
  label: string;
  won: number;
  lost: number;
  open: number;
  winRate: number | null;
}

export interface WinLoss {
  won: number;
  lost: number;
  open: number;
  decided: number;
  winRate: number | null;
  lossReasons: CountBucket[];
  byTier: SegmentWinRate[];
  byVertical: SegmentWinRate[];
  avgDaysToWin: number | null;
  daysToWinSampleSize: number;
}

export interface SourceStat {
  label: string;
  leads: number;
  avgScore: number;
  contacted: number;
  replied: number;
  won: number;
  lost: number;
  winRate: number | null;
}

export interface Analytics {
  totalLeads: number;
  byStatus: CountBucket[];
  byTier: CountBucket[];
  byVertical: CountBucket[];
  byCountry: CountBucket[];
  byVerification: CountBucket[];
  funnel: CountBucket[];
  followUp: FollowUpPerformance;
  winLoss: WinLoss;
  sources: SourceStat[];
}

const FUNNEL_STATUSES = ["new", "qualified", "contacted", "replied", "meeting", "negotiation", "won"];

/** Statuses that mean the opportunity is over and was not won. */
const LOST_STATUSES = new Set(["rejected", "not_interested", "not_a_fit", "lost", "no_response"]);

/** Statuses where a next step should exist — a lead here with no follow-up date is a leak. */
const IN_FLIGHT_STATUSES = new Set([
  "qualified",
  "contacted",
  "follow_up",
  "replied",
  "meeting",
  "negotiation",
]);

/** Statuses that can only have been reached by actually contacting them. */
const CONTACTED_ONWARD = new Set([
  "contacted",
  "follow_up",
  "replied",
  "meeting",
  "negotiation",
  "won",
  "no_response",
  "rejected",
  "not_interested",
  "not_a_fit",
  "lost",
]);

const REPLIED_ONWARD = new Set(["replied", "meeting", "negotiation", "won"]);

interface LeadRow {
  id: string;
  status: string;
  tier: string | null;
  vertical: string;
  verification_status: string;
  score: number;
  created_at: string;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  company: { country: string | null } | null;
}

interface OutreachRow {
  lead_id: string;
  channel: string;
  direction: string;
  status: string;
  result: string | null;
  sent_at: string | null;
  created_at: string;
}

function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined): CountBucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row) ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function rate(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isReply(row: OutreachRow): boolean {
  return row.status === "replied" || row.result === "replied";
}

function touchLabel(index: number): string {
  if (index === 0) return "1st touch";
  if (index === 1) return "2nd touch";
  if (index === 2) return "3rd touch";
  return "4th+ touch";
}

/**
 * Reply rate per channel and per touch number. The touch breakdown is the
 * number worth acting on: it says whether the second and third follow-ups
 * earn their time or whether replies effectively only come from the first
 * message.
 *
 * A "reply" here means an outreach row recorded as replied — this workspace
 * tracks contact attempts by hand rather than reading a mailbox, so these
 * rates only describe outreach that was actually logged.
 */
function computeFollowUp(leads: LeadRow[], outreach: OutreachRow[]): FollowUpPerformance {
  const outbound = outreach.filter((row) => row.direction === "outbound" && row.status !== "draft");

  const byChannelMap = new Map<string, { sent: number; replied: number }>();
  for (const row of outbound) {
    const bucket = byChannelMap.get(row.channel) ?? { sent: 0, replied: 0 };
    bucket.sent++;
    if (isReply(row)) bucket.replied++;
    byChannelMap.set(row.channel, bucket);
  }

  const perLead = new Map<string, OutreachRow[]>();
  for (const row of outbound) {
    const list = perLead.get(row.lead_id) ?? [];
    list.push(row);
    perLead.set(row.lead_id, list);
  }

  const touchBuckets = new Map<string, { sent: number; replied: number }>();
  for (const rows of perLead.values()) {
    const ordered = [...rows].sort(
      (a, b) => new Date(a.sent_at ?? a.created_at).getTime() - new Date(b.sent_at ?? b.created_at).getTime()
    );
    for (const [index, row] of ordered.entries()) {
      const label = touchLabel(index);
      const bucket = touchBuckets.get(label) ?? { sent: 0, replied: 0 };
      bucket.sent++;
      if (isReply(row)) bucket.replied++;
      touchBuckets.set(label, bucket);
    }
  }

  const today = startOfToday();
  let overdue = 0;
  let dueToday = 0;
  let scheduled = 0;
  let inFlightWithoutFollowUp = 0;

  for (const lead of leads) {
    if (lead.next_follow_up_at) {
      const due = new Date(lead.next_follow_up_at);
      due.setHours(0, 0, 0, 0);
      if (due.getTime() < today) overdue++;
      else if (due.getTime() === today) dueToday++;
      else scheduled++;
    } else if (IN_FLIGHT_STATUSES.has(lead.status)) {
      inFlightWithoutFollowUp++;
    }
  }

  const repliedTotal = outbound.filter(isReply).length;
  const touchOrder = ["1st touch", "2nd touch", "3rd touch", "4th+ touch"];

  return {
    recorded: outbound.length,
    replied: repliedTotal,
    replyRate: rate(repliedTotal, outbound.length),
    byChannel: Array.from(byChannelMap.entries())
      .map(([label, b]) => ({ label, sent: b.sent, replied: b.replied, replyRate: rate(b.replied, b.sent) }))
      .sort((a, b) => b.sent - a.sent),
    byTouch: touchOrder
      .filter((label) => touchBuckets.has(label))
      .map((label) => {
        const b = touchBuckets.get(label)!;
        return { label, sent: b.sent, replied: b.replied, replyRate: rate(b.replied, b.sent) };
      }),
    overdue,
    dueToday,
    scheduled,
    inFlightWithoutFollowUp,
  };
}

function segmentWinRates(leads: LeadRow[], getKey: (lead: LeadRow) => string | null): SegmentWinRate[] {
  const segments = new Map<string, { won: number; lost: number; open: number }>();
  for (const lead of leads) {
    const key = getKey(lead) ?? "unknown";
    const bucket = segments.get(key) ?? { won: 0, lost: 0, open: 0 };
    if (lead.status === "won") bucket.won++;
    else if (LOST_STATUSES.has(lead.status)) bucket.lost++;
    else bucket.open++;
    segments.set(key, bucket);
  }

  return Array.from(segments.entries())
    .map(([label, b]) => ({
      label,
      won: b.won,
      lost: b.lost,
      open: b.open,
      winRate: rate(b.won, b.won + b.lost),
    }))
    .sort((a, b) => b.won + b.lost - (a.won + a.lost));
}

/**
 * Win rate is measured against *decided* leads only (won + lost). Dividing
 * wins by every lead ever discovered would make the rate drift down forever
 * as discovery adds leads that nobody has worked yet.
 */
function computeWinLoss(leads: LeadRow[], wonAt: Map<string, string>): WinLoss {
  const won = leads.filter((lead) => lead.status === "won");
  const lost = leads.filter((lead) => LOST_STATUSES.has(lead.status));
  const decided = won.length + lost.length;

  const daysToWin: number[] = [];
  for (const lead of won) {
    const changedAt = wonAt.get(lead.id);
    if (!changedAt) continue;
    const days = (new Date(changedAt).getTime() - new Date(lead.created_at).getTime()) / 86_400_000;
    if (Number.isFinite(days) && days >= 0) daysToWin.push(days);
  }

  return {
    won: won.length,
    lost: lost.length,
    open: leads.length - decided,
    decided,
    winRate: rate(won.length, decided),
    lossReasons: countBy(lost, (lead) => lead.status),
    byTier: segmentWinRates(leads, (lead) => lead.tier),
    byVertical: segmentWinRates(leads, (lead) => lead.vertical),
    avgDaysToWin:
      daysToWin.length > 0
        ? Math.round((daysToWin.reduce((sum, d) => sum + d, 0) / daysToWin.length) * 10) / 10
        : null,
    daysToWinSampleSize: daysToWin.length,
  };
}

/**
 * Which discovery source produces leads that actually convert. A lead's
 * source is the source of its *earliest* piece of evidence — that is the
 * connector that surfaced it; later evidence is enrichment on top.
 */
function computeSources(
  leads: LeadRow[],
  evidence: { lead_id: string; source: string; discovered_at: string }[]
): SourceStat[] {
  const earliest = new Map<string, { source: string; at: number }>();
  for (const row of evidence) {
    const at = new Date(row.discovered_at).getTime();
    const current = earliest.get(row.lead_id);
    if (!current || at < current.at) earliest.set(row.lead_id, { source: row.source, at });
  }

  const stats = new Map<
    string,
    { leads: number; scoreSum: number; contacted: number; replied: number; won: number; lost: number }
  >();

  for (const lead of leads) {
    const label = earliest.get(lead.id)?.source ?? "no evidence recorded";
    const bucket =
      stats.get(label) ?? { leads: 0, scoreSum: 0, contacted: 0, replied: 0, won: 0, lost: 0 };
    bucket.leads++;
    bucket.scoreSum += lead.score;
    if (CONTACTED_ONWARD.has(lead.status) || lead.last_contacted_at) bucket.contacted++;
    if (REPLIED_ONWARD.has(lead.status)) bucket.replied++;
    if (lead.status === "won") bucket.won++;
    else if (LOST_STATUSES.has(lead.status)) bucket.lost++;
    stats.set(label, bucket);
  }

  return Array.from(stats.entries())
    .map(([label, b]) => ({
      label,
      leads: b.leads,
      avgScore: b.leads > 0 ? Math.round(b.scoreSum / b.leads) : 0,
      contacted: b.contacted,
      replied: b.replied,
      won: b.won,
      lost: b.lost,
      winRate: rate(b.won, b.won + b.lost),
    }))
    .sort((a, b) => b.won - a.won || b.replied - a.replied || b.leads - a.leads);
}

export async function getAnalytics(): Promise<Analytics> {
  const supabase = await createClient();

  const [leadsRes, outreachRes, evidenceRes, wonHistoryRes] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, status, tier, vertical, verification_status, score, created_at, last_contacted_at, next_follow_up_at, company:companies!leads_company_id_fkey ( country )"
      )
      .limit(5000),
    supabase
      .from("outreach")
      .select("lead_id, channel, direction, status, result, sent_at, created_at")
      .limit(5000),
    supabase.from("evidence").select("lead_id, source, discovered_at").limit(20000),
    supabase
      .from("lead_status_history")
      .select("lead_id, changed_at")
      .eq("new_status", "won")
      .order("changed_at", { ascending: true })
      .limit(5000),
  ]);

  if (leadsRes.error) throw leadsRes.error;
  if (outreachRes.error) throw outreachRes.error;
  if (evidenceRes.error) throw evidenceRes.error;
  if (wonHistoryRes.error) throw wonHistoryRes.error;

  const leads = (leadsRes.data ?? []) as unknown as LeadRow[];
  const outreach = (outreachRes.data ?? []) as unknown as OutreachRow[];
  const evidence = (evidenceRes.data ?? []) as { lead_id: string; source: string; discovered_at: string }[];

  // Ordered ascending, so the first row per lead is the first time it was won.
  const wonAt = new Map<string, string>();
  for (const row of wonHistoryRes.data ?? []) {
    if (!wonAt.has(row.lead_id)) wonAt.set(row.lead_id, row.changed_at);
  }

  const byStatus = countBy(leads, (r) => r.status);
  const statusCounts = new Map(byStatus.map((b) => [b.label, b.count]));

  return {
    totalLeads: leads.length,
    byStatus,
    byTier: countBy(leads, (r) => r.tier),
    byVertical: countBy(leads, (r) => r.vertical),
    byCountry: countBy(leads, (r) => r.company?.country).slice(0, 10),
    byVerification: countBy(leads, (r) => r.verification_status),
    funnel: FUNNEL_STATUSES.map((label) => ({ label, count: statusCounts.get(label) ?? 0 })),
    followUp: computeFollowUp(leads, outreach),
    winLoss: computeWinLoss(leads, wonAt),
    sources: computeSources(leads, evidence),
  };
}
