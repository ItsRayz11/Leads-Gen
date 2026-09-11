import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/api-auth";
import { createClient } from "../../../../../lib/supabase/server";
import { generateText } from "../../../../../lib/ai/client";
import {
  buildQualificationPrompt,
  parseQualificationJson,
  SIGNAL_STRENGTHS,
  type QualificationDraft,
} from "../../../../../lib/ai/qualification-prompt";
import type { Json, SignalStrength } from "@leads/db/types.js";

interface LeadRow {
  title: string;
  vertical: string;
  status: string;
  score: number;
  tier: string | null;
  service_type: string | null;
  opportunity_type: string | null;
  freshness: string | null;
  signal_strength: string | null;
  buying_signal_summary: string | null;
  qualification_summary: string | null;
  recommended_offer: string | null;
  vertical_data: Json;
  company: {
    name: string;
    website: string | null;
    industry: string | null;
    country: string | null;
    description: string | null;
    company_size: string | null;
  } | null;
  primary_contact: { name: string | null; job_title: string | null } | null;
}

const LEAD_SELECT = `
  title, vertical, status, score, tier, service_type, opportunity_type, freshness,
  signal_strength, buying_signal_summary, qualification_summary, recommended_offer, vertical_data,
  company:companies!leads_company_id_fkey ( name, website, industry, country, description, company_size ),
  primary_contact:contacts!leads_primary_contact_id_fkey ( name, job_title )
`;

/**
 * Generates a qualification assessment for one lead. Read-only on purpose:
 * nothing is written to the lead until the draft is reviewed and PATCHed
 * back, so an AI judgement never silently overwrites what's on file.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = await createClient();

  const [leadRes, signalsRes, evidenceRes, scoreRes] = await Promise.all([
    supabase.from("leads").select(LEAD_SELECT).eq("id", id).single(),
    supabase
      .from("lead_signals")
      .select("signal_type, signal_description, signal_strength, signal_date")
      .eq("lead_id", id)
      .order("signal_date", { ascending: false })
      .limit(6),
    supabase
      .from("evidence")
      .select("description, url, source, freshness")
      .eq("lead_id", id)
      .order("discovered_at", { ascending: false })
      .limit(6),
    supabase
      .from("lead_scores")
      .select("breakdown")
      .eq("lead_id", id)
      .order("computed_at", { ascending: false })
      .limit(1),
  ]);

  if (leadRes.error || !leadRes.data) {
    return NextResponse.json({ error: leadRes.error?.message ?? "Lead not found." }, { status: 404 });
  }

  const lead = leadRes.data as unknown as LeadRow;
  const breakdownRaw = scoreRes.data?.[0]?.breakdown;
  const scoreBreakdown = Array.isArray(breakdownRaw)
    ? (breakdownRaw as unknown[])
        .filter((b): b is { label: string; points: number } => {
          const row = b as { label?: unknown; points?: unknown };
          return typeof row?.label === "string" && typeof row?.points === "number";
        })
        .map((b) => ({ label: b.label, points: b.points }))
    : [];

  const prompt = buildQualificationPrompt({
    vertical: lead.vertical,
    leadTitle: lead.title,
    status: lead.status,
    score: lead.score,
    tier: lead.tier,
    serviceType: lead.service_type,
    opportunityType: lead.opportunity_type,
    freshness: lead.freshness,
    currentSignalStrength: lead.signal_strength,
    existingQualificationSummary: lead.qualification_summary,
    existingRecommendedOffer: lead.recommended_offer,
    buyingSignalSummary: lead.buying_signal_summary,
    companyName: lead.company?.name ?? "Unknown company",
    companyWebsite: lead.company?.website ?? null,
    companyIndustry: lead.company?.industry ?? null,
    companyCountry: lead.company?.country ?? null,
    companyDescription: lead.company?.description ?? null,
    companySize: lead.company?.company_size ?? null,
    contactName: lead.primary_contact?.name ?? null,
    contactTitle: lead.primary_contact?.job_title ?? null,
    signals: (signalsRes.data ?? []).map((s) => ({
      type: s.signal_type,
      description: s.signal_description,
      strength: s.signal_strength,
      date: s.signal_date,
    })),
    evidence: (evidenceRes.data ?? []).map((e) => ({
      description: e.description,
      url: e.url,
      source: e.source,
      freshness: e.freshness,
    })),
    scoreBreakdown,
    verticalData:
      lead.vertical_data && typeof lead.vertical_data === "object" && !Array.isArray(lead.vertical_data)
        ? (lead.vertical_data as Record<string, unknown>)
        : {},
  });

  const result = await generateText("lead_qualification", prompt);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 422 });

  const draft = parseQualificationJson(result.text);
  if (!draft) {
    return NextResponse.json(
      { error: `${result.provider} did not return a usable qualification JSON object.` },
      { status: 422 }
    );
  }

  return NextResponse.json({ draft, provider: result.provider, model: result.model });
}

/**
 * Applies a reviewed qualification draft to the lead. Only the three fields
 * the schema actually has columns for are written; the reasoning (fit,
 * risks, what still needs checking) is kept in the activity's metadata so the
 * judgement stays auditable instead of collapsing into a single paragraph.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = (await req.json()) as { draft?: QualificationDraft; provider?: string; model?: string };
  const draft = body.draft;

  if (!draft?.qualificationSummary?.trim()) {
    return NextResponse.json({ error: "A qualification summary is required." }, { status: 400 });
  }

  const patch: {
    qualification_summary: string;
    recommended_offer?: string | null;
    signal_strength?: SignalStrength;
  } = { qualification_summary: draft.qualificationSummary.trim() };

  if (draft.recommendedOffer !== undefined) patch.recommended_offer = draft.recommendedOffer || null;
  if (draft.signalStrength && (SIGNAL_STRENGTHS as readonly string[]).includes(draft.signalStrength)) {
    patch.signal_strength = draft.signalStrength as SignalStrength;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("activities").insert({
    lead_id: id,
    type: "research",
    description: body.provider
      ? `Qualification summary generated with ${body.provider}${body.model ? ` (${body.model})` : ""} and saved.`
      : "Qualification summary saved.",
    metadata: {
      source: "ai_qualification",
      provider: body.provider ?? null,
      model: body.model ?? null,
      signal_strength: patch.signal_strength ?? null,
      recommended_offer: patch.recommended_offer ?? null,
      fit_reasons: draft.fitReasons ?? [],
      risks: draft.risks ?? [],
      missing_information: draft.missingInformation ?? [],
    } as unknown as Json,
  });

  return NextResponse.json({ ok: true });
}
