import { createClient } from "../supabase/server";
import type { LeadStatus } from "@leads/db/types.js";

export const PIPELINE_STATUSES = [
  "new",
  "researching",
  "qualified",
  "contacted",
  "follow_up",
  "replied",
  "meeting",
  "negotiation",
  "won",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export interface PipelineCard {
  id: string;
  title: string;
  status: string;
  tier: string | null;
  score: number;
  next_follow_up_at: string | null;
  company: { name: string } | null;
}

export interface PipelineColumn {
  status: PipelineStatus;
  leads: PipelineCard[];
}

/**
 * Statuses that exist but aren't tracked as active-funnel columns: the six
 * terminal/parked outcomes, plus `archived` (soft-deleted leads, see
 * migration 0012). The board used to just filter these out with no trace,
 * which reads as "my leads disappeared" rather than "these are done/hidden".
 */
const HIDDEN_STATUSES = [
  "no_response",
  "rejected",
  "not_interested",
  "not_a_fit",
  "lost",
  "on_hold",
  "archived",
] as const;

export interface HiddenStatusCount {
  status: (typeof HIDDEN_STATUSES)[number];
  count: number;
}

const PIPELINE_SELECT = `
  id, title, status, tier, score, next_follow_up_at,
  company:companies!leads_company_id_fkey ( name )
`;

export async function getPipelineBoard(): Promise<{
  columns: PipelineColumn[];
  hidden: HiddenStatusCount[];
}> {
  const supabase = await createClient();
  const [board, hiddenCounts] = await Promise.all([
    supabase
      .from("leads")
      .select(PIPELINE_SELECT)
      .in("status", PIPELINE_STATUSES as unknown as LeadStatus[])
      .order("score", { ascending: false }),
    supabase.from("leads").select("status").in("status", HIDDEN_STATUSES as unknown as LeadStatus[]),
  ]);

  if (board.error) throw board.error;
  if (hiddenCounts.error) throw hiddenCounts.error;

  const leads = (board.data ?? []) as unknown as PipelineCard[];
  const hiddenRows = hiddenCounts.data ?? [];

  const hidden = HIDDEN_STATUSES.map((status) => ({
    status,
    count: hiddenRows.filter((row) => row.status === status).length,
  })).filter((row) => row.count > 0);

  return {
    columns: PIPELINE_STATUSES.map((status) => ({
      status,
      leads: leads.filter((lead) => lead.status === status),
    })),
    hidden,
  };
}
