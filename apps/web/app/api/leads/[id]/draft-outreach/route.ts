import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/api-auth";
import { createClient } from "../../../../../lib/supabase/server";
import { generateText } from "../../../../../lib/ai/client";
import { buildOutreachPrompt, type DraftType } from "../../../../../lib/ai/outreach-prompt";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { draftType } = (await req.json()) as { draftType: DraftType };

  const supabase = await createClient();

  const [leadRes, evidenceRes, outreachRes] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "buying_signal_summary, recommended_offer, qualification_summary, service_type, company:companies!leads_company_id_fkey(name, website, industry, country), primary_contact:contacts!leads_primary_contact_id_fkey(name, job_title)"
      )
      .eq("id", id)
      .single(),
    supabase.from("evidence").select("description, url").eq("lead_id", id).order("discovered_at", { ascending: false }).limit(3),
    supabase
      .from("outreach")
      .select("channel, message, sent_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  if (leadRes.error || !leadRes.data) {
    return NextResponse.json({ error: leadRes.error?.message ?? "Lead not found." }, { status: 404 });
  }

  const lead = leadRes.data as unknown as {
    buying_signal_summary: string | null;
    recommended_offer: string | null;
    qualification_summary: string | null;
    service_type: string | null;
    company: { name: string; website: string | null; industry: string | null; country: string | null } | null;
    primary_contact: { name: string | null; job_title: string | null } | null;
  };

  const prompt = buildOutreachPrompt(
    {
      companyName: lead.company?.name ?? "Unknown company",
      companyWebsite: lead.company?.website ?? null,
      companyIndustry: lead.company?.industry ?? null,
      companyCountry: lead.company?.country ?? null,
      contactName: lead.primary_contact?.name ?? null,
      contactTitle: lead.primary_contact?.job_title ?? null,
      buyingSignalSummary: lead.buying_signal_summary,
      recommendedOffer: lead.recommended_offer,
      qualificationSummary: lead.qualification_summary,
      serviceType: lead.service_type,
      evidence: (evidenceRes.data ?? []).map((e) => ({ description: e.description, url: e.url })),
      previousOutreach: (outreachRes.data ?? []).map((o) => ({
        channel: o.channel,
        message: o.message,
        sentAt: o.sent_at,
      })),
    },
    draftType
  );

  const result = await generateText("outreach_drafting", prompt);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 422 });

  return NextResponse.json({ draft: result.text, provider: result.provider, model: result.model });
}
