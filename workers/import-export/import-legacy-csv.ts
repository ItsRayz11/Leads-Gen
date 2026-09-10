/**
 * Ingests the hand-built "Global_Real-Time_High-Quality_Leads_*.csv" template
 * (see legacy-leads/) into companies/contacts/leads/lead_signals/evidence.
 *
 * This file's layout is a formatted report, not a plain data table: title
 * rows, a stats banner, then a header row buried a few lines down, then data
 * rows, then a "HOW TO USE" footer. We scan for the header row by looking
 * for "Rank" in column 1 rather than assuming a fixed row offset, since the
 * banner content (counts, verified-date line) varies between exports.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { createServiceRoleClient } from "@leads/db";
import type { Vertical } from "@leads/core";
import type { LeadTier, SourceType } from "@leads/db/types.js";
import { VERTICAL_LEAD_TITLE } from "../pipeline/shared.js";

const HEADER_MARKER = "rank";

interface LegacyRow {
  rank: string;
  tier: string;
  score: string;
  project: string;
  signal: string;
  firstContact: string;
  recommendedOffer: string;
  source: string;
}

function findHeaderRowIndex(rows: string[][]): number {
  const idx = rows.findIndex((row) => row[1]?.trim().toLowerCase() === HEADER_MARKER);
  if (idx === -1) {
    throw new Error(`Could not find a header row with column 1 === "Rank" in this CSV.`);
  }
  return idx;
}

export function parseLegacyCsv(csvText: string): LegacyRow[] {
  const rows: string[][] = parse(csvText, {
    relax_column_count: true,
    skip_empty_lines: false,
  });

  const headerIdx = findHeaderRowIndex(rows);
  const dataRows: LegacyRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const rank = row[1]?.trim() ?? "";
    // Data rows start with a numeric rank; anything else ends the table
    // (blank spacer row, or the "HOW TO USE THIS FILE" footer section).
    if (!/^\d+$/.test(rank)) break;

    dataRows.push({
      rank,
      tier: row[2]?.trim() ?? "",
      score: row[3]?.trim() ?? "",
      project: row[4]?.trim() ?? "",
      signal: row[5]?.trim() ?? "",
      firstContact: row[7]?.trim() ?? "",
      recommendedOffer: row[9]?.trim() ?? "",
      source: row[11]?.trim() ?? "",
    });
  }

  return dataRows;
}

export function splitContact(firstContact: string): { name: string; title: string } {
  // Template uses an em dash: "Name — Title" (sometimes with extra context
  // in parens, which we keep as part of the title).
  const parts = firstContact.split(/\s+[—–-]\s+/);
  if (parts.length < 2) {
    return { name: firstContact, title: "" };
  }
  const [name, ...rest] = parts;
  return { name: name.trim(), title: rest.join(" — ").trim() };
}

async function importLegacyCsv(filePath: string, vertical: Vertical = "hiring") {
  const supabase = createServiceRoleClient();
  const csvText = await readFile(filePath, "utf-8");
  const rows = parseLegacyCsv(csvText);

  console.log(`Parsed ${rows.length} legacy rows from ${filePath}`);
  const leadTitle = VERTICAL_LEAD_TITLE[vertical];

  for (const row of rows) {
    if (!row.project) continue;

    const existingCompany = await supabase
      .from("companies")
      .select("id")
      .ilike("name", row.project)
      .maybeSingle();

    let companyId: string;
    if (existingCompany.data) {
      companyId = existingCompany.data.id;
    } else {
      const { data: inserted, error } = await supabase
        .from("companies")
        .insert({ name: row.project })
        .select("id")
        .single();
      if (error || !inserted) throw error ?? new Error("Failed to insert company");
      companyId = inserted.id;
    }

    const existingLead = await supabase
      .from("leads")
      .select("id")
      .eq("company_id", companyId)
      .eq("title", leadTitle)
      .maybeSingle();

    let leadId: string;
    const leadFields = {
      tier: (row.tier || null) as LeadTier | null,
      score: row.score ? parseInt(row.score, 10) : 0,
      source_type: (row.source
        ? row.source.toLowerCase().includes("paid")
          ? "paid"
          : "free"
        : null) as SourceType | null,
      recommended_offer: row.recommendedOffer || null,
      buying_signal_summary: row.signal || null,
    };

    if (existingLead.data) {
      leadId = existingLead.data.id;
      await supabase.from("leads").update(leadFields).eq("id", leadId);
    } else {
      const { data: inserted, error } = await supabase
        .from("leads")
        .insert({ company_id: companyId, title: leadTitle, vertical, status: "qualified", ...leadFields })
        .select("id")
        .single();
      if (error || !inserted) throw error ?? new Error("Failed to insert lead");
      leadId = inserted.id;
    }

    if (row.signal) {
      const { data: existingSignal } = await supabase
        .from("lead_signals")
        .select("id")
        .eq("lead_id", leadId)
        .eq("signal_description", row.signal)
        .maybeSingle();
      if (!existingSignal) {
        await supabase.from("lead_signals").insert({
          lead_id: leadId,
          signal_type: "legacy_import",
          signal_description: row.signal,
          source: "legacy-csv-import",
          is_primary: true,
        });
      }
    }

    if (row.firstContact) {
      const { name, title } = splitContact(row.firstContact);
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .eq("name", name)
        .maybeSingle();

      let contactId = existingContact?.id ?? null;
      if (!contactId) {
        const { data: inserted } = await supabase
          .from("contacts")
          .insert({ company_id: companyId, name, job_title: title, source: "legacy-csv-import" })
          .select("id")
          .single();
        contactId = inserted?.id ?? null;
      }

      if (contactId) {
        await supabase.from("leads").update({ primary_contact_id: contactId }).eq("id", leadId);
      }
    }
  }

  console.log(`Imported ${rows.length} leads into vertical "${vertical}".`);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: tsx import-legacy-csv.ts <path-to-csv> [vertical]");
    process.exit(1);
  }
  const vertical = (process.argv[3] as Vertical) ?? "hiring";
  await importLegacyCsv(filePath, vertical);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
