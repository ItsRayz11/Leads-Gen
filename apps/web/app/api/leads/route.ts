import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { createClient } from "../../../lib/supabase/server";
import { insertEvidence, insertLeadWithUniqueTitle } from "../../../lib/data/lead-insert";
import type {
  LeadStatus,
  LeadTier,
  LeadVertical,
  Priority,
  SignalStrength,
  SourceType,
  VerificationStatus,
} from "@leads/db/types.js";

interface LeadCreateInput {
  companyId?: string;
  company?: {
    name?: string;
    website?: string;
    country?: string;
    industry?: string;
    companySize?: string;
    description?: string;
  };
  vertical?: LeadVertical;
  title?: string;
  opportunityType?: string;
  serviceType?: string;
  score?: number | string;
  tier?: LeadTier | "";
  status?: LeadStatus;
  priority?: Priority;
  buyingSignalSummary?: string;
  signalStrength?: SignalStrength | "";
  signalDate?: string;
  sourceType?: SourceType | "";
  owner?: string;
  recommendedOffer?: string;
  qualificationSummary?: string;
  nextFollowUpAt?: string;
  verificationStatus?: VerificationStatus;
  contact?: {
    name?: string;
    jobTitle?: string;
    email?: string;
    profileUrl?: string;
    contactMethod?: string;
    contactValue?: string;
  };
  evidence?: { url?: string; description?: string; source?: string };
}

function normalizeDomain(website: string): string {
  return website
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function clampScore(value: number | string | undefined): number {
  const score = typeof value === "string" ? parseInt(value, 10) : value;
  if (score == null || !Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

const text = (value: string | undefined) => value?.trim() || null;

export async function POST(req: NextRequest) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const input = (await req.json()) as LeadCreateInput;

  const newCompanyName = input.company?.name?.trim();
  if (!input.companyId && !newCompanyName) {
    return NextResponse.json(
      { error: "Pick an existing company or enter a new company name." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  try {
    let companyId = input.companyId ?? "";
    let companyName = "";

    if (companyId) {
      const { data: company, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", companyId)
        .single();
      if (error || !company) {
        return NextResponse.json({ error: "That company no longer exists." }, { status: 400 });
      }
      companyName = company.name;
    } else {
      companyName = newCompanyName!;
      const website = text(input.company?.website);
      const domain = website ? normalizeDomain(website) || null : null;

      // A matching domain means the company is already on file; reuse it
      // rather than tripping the unique index or creating a duplicate.
      if (domain) {
        const { data: existing } = await supabase
          .from("companies")
          .select("id, name")
          .eq("domain", domain)
          .maybeSingle();
        if (existing) {
          companyId = existing.id;
          companyName = existing.name;
        }
      }

      if (!companyId) {
        const { data: inserted, error } = await supabase
          .from("companies")
          .insert({
            name: companyName,
            website,
            domain,
            country: text(input.company?.country),
            industry: text(input.company?.industry),
            company_size: text(input.company?.companySize),
            description: text(input.company?.description),
          })
          .select("id")
          .single();
        if (error) throw error;
        companyId = inserted.id;
      }
    }

    let contactId: string | null = null;
    const contact = input.contact;
    const hasContact =
      contact &&
      (contact.name?.trim() ||
        contact.jobTitle?.trim() ||
        contact.email?.trim() ||
        contact.profileUrl?.trim() ||
        contact.contactValue?.trim());

    if (hasContact) {
      const { data: inserted, error } = await supabase
        .from("contacts")
        .insert({
          company_id: companyId,
          name: text(contact!.name),
          job_title: text(contact!.jobTitle),
          email: text(contact!.email),
          profile_url: text(contact!.profileUrl),
          contact_method: text(contact!.contactMethod),
          contact_value: text(contact!.contactValue) ?? text(contact!.email),
          source: "manual",
        })
        .select("id")
        .single();
      if (error) throw error;
      contactId = inserted.id;
    }

    const lead = await insertLeadWithUniqueTitle(supabase, {
      company_id: companyId,
      primary_contact_id: contactId,
      vertical: input.vertical ?? "general",
      title: input.title?.trim() || `${companyName} — new lead`,
      opportunity_type: text(input.opportunityType),
      service_type: text(input.serviceType),
      score: clampScore(input.score),
      tier: (text(input.tier) as LeadTier | null) ?? null,
      status: input.status ?? "new",
      priority: input.priority ?? "normal",
      buying_signal_summary: text(input.buyingSignalSummary),
      signal_strength: (text(input.signalStrength) as SignalStrength | null) ?? null,
      signal_date: text(input.signalDate),
      verification_status: input.verificationStatus ?? "unverified",
      recommended_offer: text(input.recommendedOffer),
      qualification_summary: text(input.qualificationSummary),
      owner: text(input.owner),
      source_type: (text(input.sourceType) as SourceType | null) ?? null,
      next_follow_up_at: text(input.nextFollowUpAt),
    });

    if (input.evidence?.url?.trim() || input.evidence?.description?.trim()) {
      await insertEvidence(
        supabase,
        lead.id,
        { ...input.evidence, source: input.evidence.source ?? "manual" },
        input.buyingSignalSummary?.trim() || "Evidence added when the lead was created"
      );
    }

    await supabase.from("activities").insert({
      lead_id: lead.id,
      company_id: companyId,
      type: "created",
      description: `Lead created manually: ${lead.title}`,
    });

    return NextResponse.json({ id: lead.id, title: lead.title });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create the lead." },
      { status: 500 }
    );
  }
}
