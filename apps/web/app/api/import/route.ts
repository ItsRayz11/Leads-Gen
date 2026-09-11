import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { createClient } from "../../../lib/supabase/server";
import {
  CsvParseError,
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  executePlan,
  normalizeMapping,
  normalizeOptions,
  parseCsv,
  planImport,
  suggestMapping,
} from "../../../lib/data/csv-import";

/**
 * A confirmed import writes row by row (a lead needs its company's id), so it
 * needs longer than a default serverless invocation. MAX_IMPORT_ROWS keeps it
 * inside this budget; bigger files belong in the CLI importer.
 */
export const maxDuration = 60;

/** Rows shown back in the mapping step so you can see what a column holds. */
const SAMPLE_ROWS = 5;

type Mode = "preview" | "validate" | "commit";

function readJsonField(form: FormData, key: string): unknown {
  const value = form.get(key);
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * The /import wizard's one endpoint, in three modes:
 *
 * - `preview`   — parse the file, return its headers, a suggested mapping and
 *                 a few sample rows. Touches no database.
 * - `validate`  — build the import plan with the confirmed mapping and report
 *                 what it would do. Reads the database, writes nothing.
 * - `commit`    — build the same plan and write it.
 *
 * The file is re-sent with each step rather than parked on the server: it is
 * already in the browser, and holding half-imported state between requests
 * would be its own source of bugs.
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A CSV file is required." }, { status: 400 });
  }

  const modeValue = form.get("mode");
  const mode: Mode =
    modeValue === "validate" || modeValue === "commit" ? modeValue : "preview";

  let parsed;
  try {
    parsed = parseCsv(await file.text());
  } catch (err) {
    const detail = err instanceof CsvParseError ? err.message : "unknown error";
    return NextResponse.json({ error: `Could not parse CSV: ${detail}` }, { status: 400 });
  }

  if (parsed.headers.length === 0) {
    return NextResponse.json({ error: "That file has no header row." }, { status: 400 });
  }
  if (parsed.records.length === 0) {
    return NextResponse.json({ error: "That file has a header row but no data rows." }, { status: 400 });
  }
  if (parsed.records.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      {
        error: `That file has ${parsed.records.length} rows; this importer handles up to ${MAX_IMPORT_ROWS} at a time. Split it, or use the CLI importer in workers/ for a one-off bulk load.`,
      },
      { status: 400 }
    );
  }

  if (mode === "preview") {
    return NextResponse.json({
      fileName: file.name,
      headers: parsed.headers,
      totalRows: parsed.records.length,
      suggestedMapping: suggestMapping(parsed.headers),
      sampleRows: parsed.records.slice(0, SAMPLE_ROWS),
    });
  }

  const mapping = normalizeMapping(readJsonField(form, "mapping"), parsed.headers);
  const options = normalizeOptions(readJsonField(form, "options"));

  const missingRequired = IMPORT_FIELDS.filter((field) => field.required && !mapping[field.key]);
  if (missingRequired.length > 0) {
    return NextResponse.json(
      { error: `Map a column to ${missingRequired.map((f) => f.label).join(", ")} first.` },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  let plan;
  try {
    plan = await planImport(supabase, parsed, mapping, options);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not check this file against the database." },
      { status: 500 }
    );
  }

  if (mode === "validate") {
    return NextResponse.json({
      summary: plan.summary,
      unmappedHeaders: plan.unmappedHeaders,
      // Rows with nothing to say about them would just be noise in the
      // preview; the summary already counts them. Only the fields the review
      // step renders are sent — a plan row also carries the whole raw CSV
      // record, which would balloon the response for nothing.
      rows: plan.rows
        .filter((row) => row.skipReason || row.warnings.length > 0)
        .map((row) => ({
          rowNumber: row.rowNumber,
          companyName: row.companyName,
          leadTitle: row.leadTitle,
          warnings: row.warnings,
          skipReason: row.skipReason,
        })),
      // A short sample of what will be created, so the preview isn't only
      // about problems.
      willCreate: plan.rows
        .filter((row) => !row.skipReason)
        .slice(0, 10)
        .map((row) => ({
          rowNumber: row.rowNumber,
          leadTitle: row.leadTitle,
          companyAction: row.companyAction,
          matchedCompanyName: row.matchedCompanyName,
          createsContact: row.createsContact,
          createsEvidence: row.createsEvidence,
        })),
    });
  }

  try {
    const result = await executePlan(supabase, plan, options);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "The import failed part-way through." },
      { status: 500 }
    );
  }
}
