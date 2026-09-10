import { NextRequest, NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { createClient } from "../../../lib/supabase/server";
import { formatDate, formatDateTime } from "../../../lib/utils";
import type { LeadStatus, LeadTier, LeadVertical } from "@leads/db/types.js";

const EXPORT_SELECT = `
  score, tier, status, vertical, buying_signal_summary, recommended_offer,
  next_follow_up_at, updated_at,
  company:companies!leads_company_id_fkey ( name, website, country ),
  primary_contact:contacts!leads_primary_contact_id_fkey ( name, job_title )
`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vertical = searchParams.get("vertical");
  const status = searchParams.get("status");
  const tier = searchParams.get("tier");

  const supabase = await createClient();
  let query = supabase.from("leads").select(EXPORT_SELECT).order("score", { ascending: false });

  if (vertical) query = query.eq("vertical", vertical as LeadVertical);
  if (status) query = query.eq("status", status as LeadStatus);
  if (tier) query = query.eq("tier", tier as LeadTier);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as unknown as Array<{
    score: number;
    tier: string | null;
    status: string;
    vertical: string;
    buying_signal_summary: string | null;
    recommended_offer: string | null;
    next_follow_up_at: string | null;
    updated_at: string;
    company: { name: string; website: string | null; country: string | null } | null;
    primary_contact: { name: string | null; job_title: string | null } | null;
  }>).map((lead) => ({
    Company: lead.company?.name ?? "",
    Website: lead.company?.website ?? "",
    Country: lead.company?.country ?? "",
    "Contact Name": lead.primary_contact?.name ?? "",
    "Contact Title": lead.primary_contact?.job_title ?? "",
    Tier: lead.tier ?? "",
    Score: lead.score,
    Status: lead.status,
    Vertical: lead.vertical,
    "Buying Signal": lead.buying_signal_summary ?? "",
    "Recommended Offer": lead.recommended_offer ?? "",
    "Next Follow-up": formatDate(lead.next_follow_up_at),
    "Updated At": formatDateTime(lead.updated_at),
  }));

  const csv = stringify(rows, {
    header: true,
    columns: [
      "Company", "Website", "Country", "Contact Name", "Contact Title", "Tier",
      "Score", "Status", "Vertical", "Buying Signal", "Recommended Offer",
      "Next Follow-up", "Updated At",
    ],
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leads-export-${timestamp}.csv"`,
    },
  });
}
