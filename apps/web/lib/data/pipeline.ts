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

const PIPELINE_SELECT = `
  id, title, status, tier, score, next_follow_up_at,
  company:companies!leads_company_id_fkey ( name )
`;

export async function getPipelineBoard(): Promise<PipelineColumn[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(PIPELINE_SELECT)
    .in("status", PIPELINE_STATUSES as unknown as LeadStatus[])
    .order("score", { ascending: false });

  if (error) throw error;
  const leads = (data ?? []) as unknown as PipelineCard[];

  return PIPELINE_STATUSES.map((status) => ({
    status,
    leads: leads.filter((lead) => lead.status === status),
  }));
}
