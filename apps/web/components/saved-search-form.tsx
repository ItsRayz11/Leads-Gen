"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input, Textarea } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { SearchFilterEditor } from "./search-filter-editor";
import { DiscoveryRunProgress } from "./discovery-run-progress";
import { useDiscoveryRun, type Vertical } from "../lib/hooks/use-discovery-run";
import {
  EMPTY_FILTERS,
  filtersToSearchParams,
  isFiltersEmpty,
  type StructuredSearchFilters,
} from "../lib/ai/search-filters";
import type { UseCaseStatus } from "../lib/data/ai-settings";

type InterpretSource = "ai" | "keyword_fallback";

interface InterpretResponse {
  filters: StructuredSearchFilters;
  source: InterpretSource;
  provider?: string;
  model?: string;
  note?: string;
  error?: string;
}

const VERTICAL_TO_RUN_KEY: Record<string, Vertical> = {
  hiring: "vertical1",
  general: "vertical2",
  card_affiliate: "vertical3",
  live_search: "vertical4",
};

/**
 * Two-step by design: interpret the natural-language query into structured
 * filters, let them be reviewed and corrected, then either save it for later
 * or run it now. Saving raw text alone would leave a search nothing can
 * actually run — this always interprets first (letting the AI decide the
 * vertical unless the reviewed filters say otherwise) so Run always has
 * something real to act on.
 */
export function SavedSearchForm({ aiStatus }: { aiStatus?: UseCaseStatus }) {
  const [queryText, setQueryText] = useState("");
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<StructuredSearchFilters>(EMPTY_FILTERS);
  const [source, setSource] = useState<InterpretSource | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { run, runVertical } = useDiscoveryRun();

  const interpreted = source !== null;

  async function onInterpret() {
    if (!queryText.trim()) return;
    setInterpreting(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-searches/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No vertical override from this form — the AI decides it from the
        // query text, and it stays editable in the filter editor below.
        body: JSON.stringify({ queryText, vertical: null }),
      });
      const data = (await res.json()) as InterpretResponse;
      if (!res.ok) {
        setError(data.error ?? "Could not interpret that query.");
        return;
      }
      setFilters(data.filters);
      setSource(data.source);
      setSaved(false);
      setNote(
        data.note ?? (data.source === "ai" ? `Interpreted by ${data.provider} (${data.model}).` : null)
      );
      if (!name.trim()) setName(queryText.slice(0, 80));
    } catch {
      setError("Could not reach the interpretation endpoint.");
    } finally {
      setInterpreting(false);
    }
  }

  async function onSave() {
    if (!name.trim() && !queryText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || queryText.slice(0, 80),
          queryText,
          filters,
          vertical: filters.vertical ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not save this search.");
        return;
      }
      setSaved(true);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function onRun() {
    if (!name.trim() && !queryText.trim()) return;
    const runKey = filters.vertical ? VERTICAL_TO_RUN_KEY[filters.vertical] : undefined;
    if (!runKey) {
      setError(
        `This query doesn't match any of the ${Object.keys(VERTICAL_TO_RUN_KEY).length} pipelines this app can run (${Object.keys(VERTICAL_TO_RUN_KEY).join(", ")}). Pick one from the "Vertical" dropdown at the top of the filters below, or "Save for later" / "Preview matching leads" instead — those don't need a vertical.`
      );
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const saveRes = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || queryText.slice(0, 80),
          queryText,
          filters,
          vertical: filters.vertical,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setError(saveData.error ?? "Could not save this search.");
        return;
      }
      setSaved(true);

      const configRes = await fetch(`/api/saved-searches/${saveData.savedSearch.id}/discovery-config`, {
        method: "POST",
      });
      const configData = await configRes.json();
      if (!configRes.ok) {
        setError(configData.error ?? "Could not turn this search into a discovery config.");
        return;
      }

      startTransition(() => router.refresh());
      await runVertical(runKey);
    } catch {
      setError("Could not start the run.");
    } finally {
      setRunning(false);
    }
  }

  const previewHref = `/leads?${filtersToSearchParams(filters).toString()}`;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">What type of leads are you looking for?</label>
      <Textarea
        rows={2}
        placeholder="e.g. crypto projects in Southeast Asia hiring community managers, exclude unpaid internships"
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={interpreting || !queryText.trim()} onClick={onInterpret}>
          {interpreting ? "Interpreting…" : interpreted ? "Re-interpret" : "Interpret into filters"}
        </Button>
        {aiStatus &&
          (aiStatus.ready ? (
            <Badge variant="success">AI ready — {aiStatus.provider}{aiStatus.model ? ` · ${aiStatus.model}` : ""}</Badge>
          ) : aiStatus.reason === "no_key" ? (
            <Badge variant="warning">
              {aiStatus.provider} is assigned but has no API key — will use keyword fallback
            </Badge>
          ) : (
            <Badge variant="outline">No AI provider assigned — will use keyword fallback</Badge>
          ))}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {interpreted && (
        <>
          <SearchFilterEditor filters={filters} onChange={setFilters} source={source} note={note} />

          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-64"
              placeholder="Name this search"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              disabled={running || saving}
              onClick={onRun}
              title="Saves this search and starts the live discovery pipeline for its vertical, fetching new leads"
            >
              {running ? "Running…" : "Run discovery pipeline"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={saving || running || pending} onClick={onSave}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save for later"}
            </Button>
            {!isFiltersEmpty(filters) && (
              <a href={previewHref} className="text-xs text-primary hover:underline">
                Preview matching leads →
              </a>
            )}
          </div>
        </>
      )}

      {run && <DiscoveryRunProgress run={run} />}
    </div>
  );
}
