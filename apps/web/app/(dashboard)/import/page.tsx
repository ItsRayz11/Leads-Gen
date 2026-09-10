"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Select } from "../../../components/ui/input";
import { cn } from "../../../lib/utils";
import { VERTICAL_LABELS, humanize } from "../../../lib/lead-options";
import {
  DEFAULT_IMPORT_OPTIONS,
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  VALID_STATUSES,
  VALID_VERTICALS,
  type ColumnMapping,
  type ImportOptions,
} from "../../../lib/import-fields";

interface PreviewResponse {
  fileName: string;
  headers: string[];
  totalRows: number;
  suggestedMapping: ColumnMapping;
  sampleRows: Record<string, string>[];
}

interface PlanSummary {
  rowsRead: number;
  leadsToCreate: number;
  companiesToCreate: number;
  companiesToMatch: number;
  contactsToCreate: number;
  evidenceToCreate: number;
  rowsToSkip: number;
}

interface IssueRow {
  rowNumber: number;
  companyName: string | null;
  leadTitle: string | null;
  warnings: string[];
  skipReason: string | null;
}

interface CreateRow {
  rowNumber: number;
  leadTitle: string | null;
  companyAction: "create" | "match" | null;
  matchedCompanyName: string | null;
  createsContact: boolean;
  createsEvidence: boolean;
}

interface ValidateResponse {
  summary: PlanSummary;
  unmappedHeaders: string[];
  rows: IssueRow[];
  willCreate: CreateRow[];
}

interface ImportResult {
  rowsRead: number;
  companiesCreated: number;
  companiesMatched: number;
  contactsCreated: number;
  leadsCreated: number;
  evidenceCreated: number;
  rowsSkipped: number;
  rowsFailed: number;
  warnings: string[];
}

const STEPS = ["Upload", "Map columns", "Dry run", "Import"];

export default function ImportPage() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const missingRequired = useMemo(
    () => IMPORT_FIELDS.filter((field) => field.required && !mapping[field.key]),
    [mapping]
  );

  function reset() {
    setStep(0);
    setFile(null);
    setPreview(null);
    setMapping({});
    setOptions(DEFAULT_IMPORT_OPTIONS);
    setValidation(null);
    setResult(null);
    setError(null);
  }

  async function post(mode: "preview" | "validate" | "commit") {
    if (!file) return null;
    const body = new FormData();
    body.append("file", file);
    body.append("mode", mode);
    if (mode !== "preview") {
      body.append("mapping", JSON.stringify(mapping));
      body.append("options", JSON.stringify(options));
    }
    const res = await fetch("/api/import", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  async function run(mode: "preview" | "validate" | "commit", onDone: (data: any) => void) {
    setPending(true);
    setError(null);
    try {
      const data = await post(mode);
      if (data) onDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Import Leads</h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV, confirm which column means what, see exactly what would be created,
          then import. Nothing is written to the database until the last step.
        </p>
      </div>

      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1",
              index === step
                ? "border-primary/40 bg-primary/15 text-primary"
                : index < step
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-border text-muted-foreground"
            )}
          >
            <span className="font-medium">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setValidation(null);
                setResult(null);
                setError(null);
              }}
              className="block text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-accent file:px-3 file:py-1.5 file:text-sm file:text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Up to {MAX_IMPORT_ROWS} rows per file. Column headers are matched automatically where
              they look familiar, and you can correct every one of them on the next step. Columns you
              do not map are still kept on the lead as raw data.
            </p>
            <Button
              size="sm"
              disabled={!file || pending}
              onClick={() =>
                run("preview", (data: PreviewResponse) => {
                  setPreview(data);
                  setMapping(data.suggestedMapping);
                  setStep(1);
                })
              }
            >
              {pending ? "Reading…" : "Read file"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && preview && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Map columns — {preview.fileName}, {preview.totalRows} row
                {preview.totalRows === 1 ? "" : "s"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {IMPORT_FIELDS.map((field) => {
                  const header = mapping[field.key] ?? "";
                  const sample = preview.sampleRows
                    .map((row) => row[header])
                    .find((value) => value?.trim());
                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium">
                        {field.label}
                        {field.required && <Badge variant="warning">required</Badge>}
                      </label>
                      <Select
                        className="w-full"
                        value={header}
                        onChange={(event) =>
                          setMapping((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                      >
                        <option value="">— not in this file —</option>
                        {preview.headers.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-muted-foreground">{field.hint}</p>
                      {header && (
                        <p className="truncate text-xs text-muted-foreground/80">
                          e.g. {sample ? `"${sample}"` : "(blank in the first rows)"}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Vertical for rows without one</label>
                  <Select
                    className="w-full"
                    value={options.defaultVertical}
                    onChange={(event) =>
                      setOptions((current) => ({
                        ...current,
                        defaultVertical: event.target.value as ImportOptions["defaultVertical"],
                      }))
                    }
                  >
                    {VALID_VERTICALS.map((vertical) => (
                      <option key={vertical} value={vertical}>
                        {VERTICAL_LABELS[vertical]}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Status for rows without one</label>
                  <Select
                    className="w-full"
                    value={options.defaultStatus}
                    onChange={(event) =>
                      setOptions((current) => ({
                        ...current,
                        defaultStatus: event.target.value as ImportOptions["defaultStatus"],
                      }))
                    }
                  >
                    {VALID_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {humanize(status)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Leads already on file</label>
                  <Select
                    className="w-full"
                    value={options.onDuplicateLead}
                    onChange={(event) =>
                      setOptions((current) => ({
                        ...current,
                        onDuplicateLead: event.target.value as ImportOptions["onDuplicateLead"],
                      }))
                    }
                  >
                    <option value="skip">Skip the row</option>
                    <option value="create">Import anyway, with a numbered title</option>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Matched on company plus buying signal — the same pair the lead title is built from.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={options.matchCompaniesByName}
                      onChange={(event) =>
                        setOptions((current) => ({
                          ...current,
                          matchCompaniesByName: event.target.checked,
                        }))
                      }
                    />
                    Match companies by name when a row has no website
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Off by default: the domain is the reliable dedupe key, and two unrelated companies
                    can share a name. Rows in this file that repeat a name always share one company
                    either way.
                  </p>
                </div>
              </div>

              {missingRequired.length > 0 && (
                <p className="text-xs text-destructive">
                  Map a column to {missingRequired.map((field) => field.label).join(", ")} before continuing.
                </p>
              )}

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setStep(0)} disabled={pending}>
                  Back
                </Button>
                <Button
                  size="sm"
                  disabled={pending || missingRequired.length > 0}
                  onClick={() =>
                    run("validate", (data: ValidateResponse) => {
                      setValidation(data);
                      setStep(2);
                    })
                  }
                >
                  {pending ? "Checking…" : "Dry run"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && validation && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dry run — nothing has been written yet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">Rows read: {validation.summary.rowsRead}</Badge>
                <Badge variant="success">Leads to create: {validation.summary.leadsToCreate}</Badge>
                <Badge variant="success">New companies: {validation.summary.companiesToCreate}</Badge>
                <Badge variant="primary">Existing companies: {validation.summary.companiesToMatch}</Badge>
                <Badge variant="success">Contacts: {validation.summary.contactsToCreate}</Badge>
                <Badge variant="success">Evidence: {validation.summary.evidenceToCreate}</Badge>
                <Badge variant={validation.summary.rowsToSkip > 0 ? "warning" : "outline"}>
                  Rows skipped: {validation.summary.rowsToSkip}
                </Badge>
              </div>

              {validation.unmappedHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Not mapped to a field: {validation.unmappedHeaders.join(", ")}. These are still
                  stored on each lead as raw row data.
                </p>
              )}
            </CardContent>
          </Card>

          {validation.willCreate.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>First {validation.willCreate.length} leads this would create</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {validation.willCreate.map((row) => (
                    <li key={row.rowNumber} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Row {row.rowNumber}</span>
                      <span>{row.leadTitle}</span>
                      <Badge variant={row.companyAction === "match" ? "primary" : "success"}>
                        {row.companyAction === "match"
                          ? `existing company${row.matchedCompanyName ? `: ${row.matchedCompanyName}` : ""}`
                          : "new company"}
                      </Badge>
                      {row.createsContact && <Badge variant="outline">+ contact</Badge>}
                      {row.createsEvidence && <Badge variant="outline">+ evidence</Badge>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {validation.rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rows with something to flag ({validation.rows.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                        <th className="px-2 py-1.5">Row</th>
                        <th className="px-2 py-1.5">Company</th>
                        <th className="px-2 py-1.5">What happens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.rows.map((row) => (
                        <tr key={row.rowNumber} className="border-b border-border last:border-0">
                          <td className="px-2 py-1.5 align-top text-muted-foreground">{row.rowNumber}</td>
                          <td className="px-2 py-1.5 align-top">{row.companyName ?? "—"}</td>
                          <td className="px-2 py-1.5 align-top">
                            {row.skipReason ? (
                              <span className="text-destructive">Skipped — {row.skipReason}</span>
                            ) : (
                              <ul className="space-y-0.5 text-warning">
                                {row.warnings.map((warning, index) => (
                                  <li key={index}>{warning}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setStep(1)} disabled={pending}>
              Back to mapping
            </Button>
            <Button
              size="sm"
              disabled={pending || validation.summary.leadsToCreate === 0}
              onClick={() =>
                run("commit", (data: ImportResult) => {
                  setResult(data);
                  setStep(3);
                })
              }
            >
              {pending
                ? "Importing…"
                : `Import ${validation.summary.leadsToCreate} lead${
                    validation.summary.leadsToCreate === 1 ? "" : "s"
                  }`}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <Card>
          <CardHeader>
            <CardTitle>Imported</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">Rows read: {result.rowsRead}</Badge>
              <Badge variant="success">Leads created: {result.leadsCreated}</Badge>
              <Badge variant="success">Companies created: {result.companiesCreated}</Badge>
              <Badge variant="primary">Companies matched: {result.companiesMatched}</Badge>
              <Badge variant="success">Contacts created: {result.contactsCreated}</Badge>
              <Badge variant="success">Evidence created: {result.evidenceCreated}</Badge>
              <Badge variant={result.rowsSkipped > 0 ? "warning" : "outline"}>
                Rows skipped: {result.rowsSkipped}
              </Badge>
              <Badge variant={result.rowsFailed > 0 ? "destructive" : "outline"}>
                Rows failed: {result.rowsFailed}
              </Badge>
            </div>

            {result.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Row notes</p>
                <ul className="max-h-64 space-y-1 overflow-y-auto text-sm text-muted-foreground">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Link href="/leads">
                <Button size="sm">View leads</Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={reset}>
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
