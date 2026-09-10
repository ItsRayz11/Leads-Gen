import { parse } from "csv-parse/sync";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeadStatus, LeadTier, LeadVertical } from "@leads/db/types.js";
import { insertLeadWithUniqueTitle } from "./lead-insert";
import {
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  VALID_STATUSES,
  VALID_TIERS,
  VALID_VERTICALS,
  type ColumnMapping,
  type ImportOptions,
} from "../import-fields";

export * from "../import-fields";

type Client = SupabaseClient<Database>;

/**
 * Everything the /import wizard and its API route share: what a mappable
 * field is, how a CSV row becomes lead/company/contact values, what a dry
 * run would do, and how a confirmed run does it.
 *
 * The dry run and the real run walk the *same* plan, built by planImport(),
 * so the preview can't drift away from what the import actually writes.
 */

export class CsvParseError extends Error {}

export interface ParsedCsv {
  headers: string[];
  records: Record<string, string>[];
}

export function parseCsv(text: string): ParsedCsv {
  let headers: string[] = [];
  let records: Record<string, string>[];
  try {
    records = parse(text, {
      columns: (raw: string[]) => {
        headers = dedupeHeaders(raw.map((h) => h.trim()));
        return headers;
      },
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });
  } catch (err) {
    throw new CsvParseError(err instanceof Error ? err.message : "unknown error");
  }
  return { headers, records };
}

/**
 * csv-parse rejects a file with two identically named columns. Suffixing the
 * repeats keeps the file importable — the mapping step then shows both, and
 * you pick the one you meant.
 */
function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

/** Auto-detects a mapping from header names; every field the user can still override. */
export function suggestMapping(headers: string[]): ColumnMapping {
  const byLower = new Map<string, string>();
  for (const header of headers) {
    const key = header.trim().toLowerCase();
    if (!byLower.has(key)) byLower.set(key, header);
  }

  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    for (const synonym of field.synonyms) {
      const header = byLower.get(synonym);
      if (header && !used.has(header)) {
        mapping[field.key] = header;
        used.add(header);
        break;
      }
    }
  }
  return mapping;
}

/** Drops anything pointing at a header the uploaded file doesn't have. */
export function normalizeMapping(raw: unknown, headers: string[]): ColumnMapping {
  const known = new Set(headers);
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const mapping: ColumnMapping = {};
  for (const field of IMPORT_FIELDS) {
    const value = input[field.key];
    if (typeof value === "string" && known.has(value)) mapping[field.key] = value;
  }
  return mapping;
}

export function normalizeDomain(website: string): string {
  return website
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

/** Keeps a generated lead title short enough to stay readable in the table. */
function truncate(text: string, length: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

export function leadTitleFor(companyName: string, signal: string | null): string {
  return signal ? `${companyName} — ${truncate(signal, 60)}` : `${companyName} — imported lead`;
}

type RowValues = Record<string, string>;

function readRow(record: Record<string, string>, mapping: ColumnMapping): RowValues {
  const values: RowValues = {};
  for (const field of IMPORT_FIELDS) {
    const header = mapping[field.key];
    if (!header) continue;
    const value = record[header];
    if (typeof value === "string" && value.trim()) values[field.key] = value.trim();
  }
  return values;
}

export interface PlannedRow {
  /** 1-indexed line in the file, header row included — matches what a spreadsheet shows. */
  rowNumber: number;
  companyName: string | null;
  domain: string | null;
  leadTitle: string | null;
  /** null when the row is skipped. */
  companyAction: "create" | "match" | null;
  /** Name of the existing company this row will attach to, when matched. */
  matchedCompanyName: string | null;
  createsContact: boolean;
  createsEvidence: boolean;
  /** Set when an earlier row in the same file already covers this lead. */
  duplicateOfRow: number | null;
  /** Non-fatal notes: coerced values, dropped fields. */
  warnings: string[];
  /** Set when the row will not be imported at all. */
  skipReason: string | null;
  values: RowValues;
  /** The untouched CSV row, stored on the lead so a wrong mapping loses nothing. */
  raw: Record<string, string>;
  vertical: LeadVertical;
  status: LeadStatus;
  tier: LeadTier | null;
  score: number;
  /** Key the executor uses to reuse a company created earlier in the same run. */
  companyKey: string;
  existingCompanyId: string | null;
}

export interface ImportPlan {
  rows: PlannedRow[];
  unmappedHeaders: string[];
  summary: {
    rowsRead: number;
    leadsToCreate: number;
    companiesToCreate: number;
    companiesToMatch: number;
    contactsToCreate: number;
    evidenceToCreate: number;
    rowsToSkip: number;
  };
}

async function chunkedIn<T>(
  values: string[],
  size: number,
  run: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(...(await run(values.slice(i, i + size))));
  }
  return out;
}

/**
 * Works out what an import would do, without writing anything: which
 * companies already exist, which rows are unusable, which leads are already
 * on file. The wizard shows this as its dry run, and executePlan() then
 * walks the exact same rows.
 */
export async function planImport(
  supabase: Client,
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  options: ImportOptions
): Promise<ImportPlan> {
  const { headers, records } = parsed;
  const mappedHeaders = new Set(Object.values(mapping).filter(Boolean));

  // First pass: read every row's values, with no database access.
  const drafts = records.map((record, index) => ({
    rowNumber: index + 2, // header row is line 1
    record,
    values: readRow(record, mapping),
  }));

  const domains = new Set<string>();
  const namesWithoutDomain = new Set<string>();
  for (const draft of drafts) {
    const website = draft.values.website;
    const domain = website ? normalizeDomain(website) : "";
    if (domain) domains.add(domain);
    else if (options.matchCompaniesByName && draft.values.company) {
      namesWithoutDomain.add(draft.values.company);
    }
  }

  // Second pass: resolve existing companies in a couple of batched queries
  // rather than one lookup per row.
  const byDomain = new Map<string, { id: string; name: string }>();
  if (domains.size > 0) {
    const found = await chunkedIn(Array.from(domains), 200, async (chunk) => {
      const { data, error } = await supabase.from("companies").select("id, name, domain").in("domain", chunk);
      if (error) throw error;
      return data ?? [];
    });
    for (const company of found) {
      if (company.domain) byDomain.set(company.domain, { id: company.id, name: company.name });
    }
  }

  const byName = new Map<string, { id: string; name: string }>();
  if (namesWithoutDomain.size > 0) {
    const found = await chunkedIn(Array.from(namesWithoutDomain), 200, async (chunk) => {
      const { data, error } = await supabase.from("companies").select("id, name").in("name", chunk);
      if (error) throw error;
      return data ?? [];
    });
    for (const company of found) {
      const key = company.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, { id: company.id, name: company.name });
    }
  }

  // Titles already used at the companies these rows will attach to, so the
  // dry run can say "already on file" instead of silently suffixing.
  const existingIds = Array.from(
    new Set([...byDomain.values(), ...byName.values()].map((company) => company.id))
  );
  const existingTitles = new Set<string>();
  if (existingIds.length > 0) {
    const found = await chunkedIn(existingIds, 200, async (chunk) => {
      const { data, error } = await supabase.from("leads").select("company_id, title").in("company_id", chunk);
      if (error) throw error;
      return data ?? [];
    });
    for (const lead of found) existingTitles.add(`${lead.company_id}::${lead.title.toLowerCase()}`);
  }

  const rows: PlannedRow[] = [];
  const seenLeadKeys = new Map<string, number>();
  const summary = {
    rowsRead: records.length,
    leadsToCreate: 0,
    companiesToCreate: 0,
    companiesToMatch: 0,
    contactsToCreate: 0,
    evidenceToCreate: 0,
    rowsToSkip: 0,
  };

  for (const draft of drafts) {
    const { rowNumber, values } = draft;
    const warnings: string[] = [];

    const companyName = values.company ?? null;
    const domain = values.website ? normalizeDomain(values.website) || null : null;

    const row: PlannedRow = {
      rowNumber,
      companyName,
      domain,
      leadTitle: null,
      companyAction: null,
      matchedCompanyName: null,
      createsContact: false,
      createsEvidence: false,
      duplicateOfRow: null,
      warnings,
      skipReason: null,
      values,
      raw: draft.record,
      vertical: options.defaultVertical,
      status: options.defaultStatus,
      tier: null,
      score: 0,
      companyKey: "",
      existingCompanyId: null,
    };

    if (!companyName) {
      row.skipReason = mapping.company
        ? `The "${mapping.company}" column is empty on this row.`
        : "No column is mapped to Company.";
      summary.rowsToSkip++;
      rows.push(row);
      continue;
    }

    if (values.vertical) {
      const match = VALID_VERTICALS.find((v) => v.toLowerCase() === values.vertical.toLowerCase());
      if (match) row.vertical = match;
      else warnings.push(`Vertical "${values.vertical}" is not one this app knows — using "${options.defaultVertical}".`);
    }

    if (values.status) {
      const match = VALID_STATUSES.find((s) => s.toLowerCase() === values.status.toLowerCase());
      if (match) row.status = match;
      else warnings.push(`Status "${values.status}" is not one this app knows — using "${options.defaultStatus}".`);
    }

    if (values.tier) {
      const match = VALID_TIERS.find((t) => t.toLowerCase() === values.tier.toLowerCase());
      if (match) row.tier = match;
      else warnings.push(`Tier "${values.tier}" is not one this app knows — leaving it blank.`);
    }

    if (values.score) {
      const parsed = parseInt(values.score, 10);
      if (!Number.isFinite(parsed)) {
        warnings.push(`Score "${values.score}" is not a number — using 0.`);
      } else {
        row.score = Math.max(0, Math.min(100, parsed));
        if (row.score !== parsed) warnings.push(`Score ${parsed} is outside 0–100 — clamped to ${row.score}.`);
      }
    }

    // Rows in the same file that describe the same company share one company
    // record: by domain when there is one, otherwise by name, since a repeated
    // name inside a single file is one company, not two.
    row.companyKey = domain ? `domain:${domain}` : `name:${companyName.toLowerCase()}`;

    const existing = domain
      ? byDomain.get(domain)
      : options.matchCompaniesByName
        ? byName.get(companyName.toLowerCase())
        : undefined;

    if (existing) {
      row.existingCompanyId = existing.id;
      row.matchedCompanyName = existing.name;
      if (existing.name !== companyName) {
        warnings.push(`Matched the existing company "${existing.name}" and will rename it to "${companyName}".`);
      }
    } else if (!domain && !values.website) {
      warnings.push("No website on this row, so it can't be deduped against companies already on file by domain.");
    }

    row.leadTitle = leadTitleFor(companyName, values.signal ?? null);

    const leadKey = `${row.companyKey}::${row.leadTitle.toLowerCase()}`;
    const firstRowWithLead = seenLeadKeys.get(leadKey);
    if (firstRowWithLead !== undefined) {
      row.duplicateOfRow = firstRowWithLead;
      if (options.onDuplicateLead === "skip") {
        row.skipReason = `Row ${firstRowWithLead} already covers this lead.`;
      } else {
        warnings.push(`Row ${firstRowWithLead} covers the same lead — this one gets a numbered title.`);
      }
    } else {
      seenLeadKeys.set(leadKey, rowNumber);
    }

    if (
      !row.skipReason &&
      row.existingCompanyId &&
      existingTitles.has(`${row.existingCompanyId}::${row.leadTitle.toLowerCase()}`)
    ) {
      if (options.onDuplicateLead === "skip") {
        row.skipReason = "This lead is already on file for that company.";
      } else {
        warnings.push("A lead with this title already exists for that company — this one gets a numbered title.");
      }
    }

    if (row.skipReason) {
      // A skipped row writes nothing at all, so companyAction stays null and
      // it never claims a company for itself.
      summary.rowsToSkip++;
      rows.push(row);
      continue;
    }

    // "match" means this row attaches to a company that was already in the
    // database. A second row for a company this same run creates is still a
    // creation — companyKey is what keeps the two rows on one company.
    row.companyAction = row.existingCompanyId ? "match" : "create";

    row.createsContact = Boolean(
      values.contactName || values.contactTitle || values.contactEmail || values.contactProfileUrl
    );
    row.createsEvidence = Boolean(values.evidenceUrl);

    summary.leadsToCreate++;
    if (row.createsContact) summary.contactsToCreate++;
    if (row.createsEvidence) summary.evidenceToCreate++;
    rows.push(row);
  }

  // Counted over distinct companies rather than rows: ten rows for one
  // existing company is one company matched, not ten.
  summary.companiesToCreate = new Set(
    rows.filter((row) => row.companyAction === "create").map((row) => row.companyKey)
  ).size;
  summary.companiesToMatch = new Set(
    rows.filter((row) => row.companyAction === "match").map((row) => row.existingCompanyId!)
  ).size;

  return {
    rows,
    unmappedHeaders: headers.filter((header) => !mappedHeaders.has(header)),
    summary,
  };
}

export interface ImportResult {
  rowsRead: number;
  companiesCreated: number;
  companiesMatched: number;
  contactsCreated: number;
  leadsCreated: number;
  evidenceCreated: number;
  rowsSkipped: number;
  /** Rows that failed mid-write, as opposed to rows the plan already skipped. */
  rowsFailed: number;
  warnings: string[];
}

/**
 * Writes the plan. Rows the plan marked skipped are counted, never written.
 * A row that fails part-way is reported and the run continues — one bad row
 * shouldn't cost you the other 400.
 */
export async function executePlan(
  supabase: Client,
  plan: ImportPlan,
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    rowsRead: plan.summary.rowsRead,
    companiesCreated: 0,
    companiesMatched: 0,
    contactsCreated: 0,
    leadsCreated: 0,
    evidenceCreated: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
    warnings: [],
  };

  /** Company ids resolved so far in this run, keyed the same way the plan keyed them. */
  const companyIds = new Map<string, string>();
  const pendingEvidence: { lead_id: string; source: string; url: string; description: string }[] = [];

  for (const row of plan.rows) {
    if (row.skipReason) {
      result.rowsSkipped++;
      result.warnings.push(`Row ${row.rowNumber}: skipped — ${row.skipReason}`);
      continue;
    }

    const values = row.values;
    try {
      let companyId = companyIds.get(row.companyKey) ?? row.existingCompanyId ?? null;

      if (companyId) {
        // Only overwrite a column the CSV actually has a value for; a blank
        // cell means "not in this file", not "clear what's on file".
        const patch: Database["public"]["Tables"]["companies"]["Update"] = {};
        if (row.companyName) patch.name = row.companyName;
        if (values.website) patch.website = values.website;
        if (values.industry) patch.industry = values.industry;
        if (values.country) patch.country = values.country;
        if (values.region) patch.region = values.region;
        if (values.companySize) patch.company_size = values.companySize;
        if (Object.keys(patch).length > 0) {
          const { error } = await supabase.from("companies").update(patch).eq("id", companyId);
          if (error) throw error;
        }
        if (!companyIds.has(row.companyKey)) result.companiesMatched++;
      } else {
        const { data, error } = await supabase
          .from("companies")
          .insert({
            name: row.companyName!,
            website: values.website ?? null,
            domain: row.domain,
            industry: values.industry ?? null,
            country: values.country ?? null,
            region: values.region ?? null,
            company_size: values.companySize ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        companyId = data.id;
        result.companiesCreated++;
      }

      companyIds.set(row.companyKey, companyId);

      let contactId: string | null = null;
      if (row.createsContact) {
        const { data, error } = await supabase
          .from("contacts")
          .insert({
            company_id: companyId,
            name: values.contactName ?? null,
            job_title: values.contactTitle ?? null,
            email: values.contactEmail ?? null,
            profile_url: values.contactProfileUrl ?? null,
            contact_method: values.contactEmail ? "email" : null,
            contact_value: values.contactEmail ?? values.contactProfileUrl ?? null,
            source: "import",
          })
          .select("id")
          .single();
        if (error) {
          // The lead is still worth having without its contact.
          result.warnings.push(`Row ${row.rowNumber}: contact not created (${error.message}).`);
        } else {
          contactId = data.id;
          result.contactsCreated++;
        }
      }

      const lead = await insertLeadWithUniqueTitle(supabase, {
        company_id: companyId,
        primary_contact_id: contactId,
        vertical: row.vertical,
        title: row.leadTitle!,
        score: row.score,
        tier: row.tier,
        status: row.status,
        service_type: values.serviceType ?? null,
        buying_signal_summary: values.signal ?? null,
        recommended_offer: null,
        // The untouched CSV row, so a column you did not map — or mapped
        // wrongly — is still recoverable from the lead afterwards.
        vertical_data: row.raw,
      });
      result.leadsCreated++;

      if (row.createsEvidence) {
        pendingEvidence.push({
          lead_id: lead.id,
          source: "import",
          url: values.evidenceUrl,
          description: values.signal ?? `Source cited in the imported row for ${row.companyName}`,
        });
      }

      for (const warning of row.warnings) {
        result.warnings.push(`Row ${row.rowNumber}: ${warning}`);
      }
    } catch (err) {
      result.rowsFailed++;
      result.warnings.push(
        `Row ${row.rowNumber}: not imported — ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }

  // Evidence has no dependants, so it goes in one insert at the end instead
  // of a round trip per row.
  if (pendingEvidence.length > 0) {
    const { error } = await supabase.from("evidence").insert(pendingEvidence);
    if (error) {
      result.warnings.push(`Evidence rows were not created (${error.message}).`);
    } else {
      result.evidenceCreated = pendingEvidence.length;
    }
  }

  return result;
}
