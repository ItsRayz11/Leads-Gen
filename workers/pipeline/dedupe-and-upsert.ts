import { createServiceRoleClient } from "@leads/db";
import type { RawSignal, Vertical } from "@leads/core";
import type { Json } from "@leads/db/types.js";
import type { ScoreRule } from "../scoring/score.js";
import { rescoreLead } from "./rescore-lead.js";
import {
  VERTICAL_LEAD_TITLE,
  freshnessFromDate,
  groupSignalsByCompany,
  normalizeDomain,
} from "./shared.js";

function firstMeta(signals: RawSignal[], key: string): string | undefined {
  for (const signal of signals) {
    const value = signal.meta?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

/**
 * Groups raw signals by (vertical, company identity), upserts one company +
 * one lead (opportunity) per group, records signals/evidence/contacts, then
 * scores the lead against the vertical's rule set. Idempotent to re-run:
 * evidence already recorded for a lead (matched by URL) isn't re-inserted,
 * and human-edited lead fields (status, priority, owner, ...) are never
 * overwritten by a later pipeline run.
 */
export async function dedupeAndUpsert(
  rawSignals: RawSignal[],
  rules: ScoreRule[]
): Promise<{ leadId: string; companyName: string; score: number }[]> {
  const supabase = createServiceRoleClient();

  const groups = groupSignalsByCompany(rawSignals);

  const results: { leadId: string; companyName: string; score: number }[] = [];

  for (const [, signals] of groups) {
    const vertical = signals[0].vertical as Vertical;
    const companyName = signals[0].projectName;
    const website = signals.find((s) => s.website)?.website ?? null;
    const domain = normalizeDomain(website);

    const companyEnrichment = {
      industry: firstMeta(signals, "industry"),
      country: firstMeta(signals, "country"),
      region: firstMeta(signals, "region"),
      city: firstMeta(signals, "city"),
      company_size: firstMeta(signals, "companySize"),
    };

    let companyId: string;
    const existingCompanySelect = "id, industry, country, region, city, company_size";
    const existingCompany = domain
      ? await supabase.from("companies").select(existingCompanySelect).eq("domain", domain).maybeSingle()
      : await supabase.from("companies").select(existingCompanySelect).ilike("name", companyName).maybeSingle();

    if (existingCompany.data) {
      companyId = existingCompany.data.id;
      // Only fill fields still blank — never overwrite a value another
      // connector or a human already set.
      const patch: {
        website?: string;
        industry?: string;
        country?: string;
        region?: string;
        city?: string;
        company_size?: string;
      } = {};
      if (website) patch.website = website;
      for (const [field, value] of Object.entries(companyEnrichment) as [keyof typeof companyEnrichment, string | undefined][]) {
        if (value && !existingCompany.data[field]) patch[field] = value;
      }
      if (Object.keys(patch).length > 0) await supabase.from("companies").update(patch).eq("id", companyId);
    } else {
      const { data: inserted, error } = await supabase
        .from("companies")
        .insert({ name: companyName, website, domain, ...companyEnrichment })
        .select("id")
        .single();
      if (error || !inserted) throw error ?? new Error("Failed to insert company");
      companyId = inserted.id;
    }

    for (const sourceConnector of new Set(signals.map((s) => s.sourceConnector))) {
      const existingSource = await supabase
        .from("company_sources")
        .select("id")
        .eq("company_id", companyId)
        .eq("source_name", sourceConnector)
        .maybeSingle();
      if (!existingSource.data) {
        await supabase.from("company_sources").insert({ company_id: companyId, source_name: sourceConnector });
      }
    }

    const leadEnrichment = {
      opportunity_type: firstMeta(signals, "opportunityType"),
      service_type: firstMeta(signals, "serviceType"),
    };

    const leadTitle = VERTICAL_LEAD_TITLE[vertical];
    let leadId: string;
    const existingLead = await supabase
      .from("leads")
      .select("id, opportunity_type, service_type")
      .eq("company_id", companyId)
      .eq("title", leadTitle)
      .maybeSingle();

    if (existingLead.data) {
      leadId = existingLead.data.id;
      const patch: { opportunity_type?: string; service_type?: string } = {};
      for (const [field, value] of Object.entries(leadEnrichment) as [keyof typeof leadEnrichment, string | undefined][]) {
        if (value && !existingLead.data[field]) patch[field] = value;
      }
      if (Object.keys(patch).length > 0) await supabase.from("leads").update(patch).eq("id", leadId);
    } else {
      const { data: inserted, error } = await supabase
        .from("leads")
        .insert({
          company_id: companyId,
          title: leadTitle,
          vertical,
          source_type: "free",
          status: "new",
          ...leadEnrichment,
        })
        .select("id")
        .single();
      if (error || !inserted) throw error ?? new Error("Failed to insert lead");
      leadId = inserted.id;
    }

    const { data: existingEvidence } = await supabase.from("evidence").select("url").eq("lead_id", leadId);
    const existingUrls = new Set((existingEvidence ?? []).map((e) => e.url).filter(Boolean));

    let strongestSignalDate: Date | null = null;
    for (const signal of signals) {
      if (signal.evidenceUrl && existingUrls.has(signal.evidenceUrl)) continue;

      const postedAt = signal.meta?.postedAt instanceof Date ? signal.meta.postedAt : null;
      const signalDate = postedAt ?? signal.discoveredAt;
      if (!strongestSignalDate || signalDate > strongestSignalDate) strongestSignalDate = signalDate;
      const freshness = freshnessFromDate(signalDate);

      let evidenceId: string | null = null;
      if (signal.evidenceUrl) {
        const { data: evidence } = await supabase
          .from("evidence")
          .insert({
            lead_id: leadId,
            source: signal.sourceConnector,
            url: signal.evidenceUrl,
            description: signal.signalText,
            discovered_at: signal.discoveredAt.toISOString(),
            published_at: postedAt?.toISOString() ?? null,
            freshness,
          })
          .select("id")
          .single();
        evidenceId = evidence?.id ?? null;
      }

      await supabase.from("lead_signals").insert({
        lead_id: leadId,
        signal_type: signal.sourceConnector,
        signal_description: signal.signalText,
        signal_date: signalDate.toISOString().slice(0, 10),
        source: signal.sourceConnector,
        evidence_id: evidenceId,
        freshness,
        raw_payload: signal.raw as Json,
      });

      if (signal.evidenceUrl) existingUrls.add(signal.evidenceUrl);
    }

    if (strongestSignalDate) {
      await supabase
        .from("leads")
        .update({
          buying_signal_summary: signals[signals.length - 1].signalText,
          signal_date: strongestSignalDate.toISOString().slice(0, 10),
          freshness: freshnessFromDate(strongestSignalDate),
        })
        .eq("id", leadId);
    }

    const contactsToInsert = signals.flatMap((s) => s.contacts ?? []);
    if (contactsToInsert.length > 0) {
      const { data: existingContacts } = await supabase
        .from("contacts")
        .select("id, contact_value")
        .eq("company_id", companyId);
      const existingValues = new Set((existingContacts ?? []).map((c) => c.contact_value));

      let firstNewContactId: string | null = null;
      for (const contact of contactsToInsert) {
        if (existingValues.has(contact.contactValue)) continue;
        const { data: inserted } = await supabase
          .from("contacts")
          .insert({
            company_id: companyId,
            name: contact.name,
            job_title: contact.title,
            contact_method: contact.contactMethod,
            contact_value: contact.contactValue,
            source: contact.contactMethod,
          })
          .select("id")
          .single();
        if (inserted && !firstNewContactId) firstNewContactId = inserted.id;
        existingValues.add(contact.contactValue);
      }

      const { data: leadRow } = await supabase.from("leads").select("primary_contact_id").eq("id", leadId).single();
      if (firstNewContactId && !leadRow?.primary_contact_id) {
        await supabase.from("leads").update({ primary_contact_id: firstNewContactId }).eq("id", leadId);
      }
    }

    const { score } = await rescoreLead(supabase, leadId, vertical, rules);
    results.push({ leadId, companyName, score });
  }

  return results;
}
